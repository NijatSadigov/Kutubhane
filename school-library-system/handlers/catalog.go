package handlers

import (
	"strconv"
	"strings"

	"school-library-system/catalog"
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// CatalogHit is one result from a global catalog search: an Edition, with
// enough of its Work to be recognisable, plus how it relates to the caller's
// own branch.
type CatalogHit struct {
	EditionID       uint   `json:"edition_id"`
	WorkID          uint   `json:"work_id"`
	Title           string `json:"title"`
	WorkTitle       string `json:"work_title"`
	AuthorName      string `json:"author_name"`
	PublisherName   string `json:"publisher_name"`
	ISBN13          string `json:"isbn13"`
	Language        string `json:"language"`
	PublicationYear int    `json:"publication_year"`
	PageCount       int    `json:"page_count"`
	CoverURL        string `json:"cover_url"`
	CEFRLevel       string `json:"cefr_level"`
	EditionLabel    string `json:"edition_label"`

	// HoldingCount is how many branches anywhere stock this edition — the
	// signal that a record is real and already in use.
	HoldingCount int `json:"holding_count"`
	// AlreadyHeld tells the librarian their own branch stocks this already, so
	// the form can offer "add another copy" instead of a duplicate holding.
	AlreadyHeld bool `json:"already_held"`
	// LocalBookID is the caller's own holding, when AlreadyHeld.
	LocalBookID *uint `json:"local_book_id,omitempty"`
}

// SearchCatalog looks across the whole shared catalog, not just the caller's
// branch. This is what the "add a book" form searches before offering to
// create a new record, so two branches stocking the same book end up pointing
// at one Edition instead of typing it in twice.
//
// Query parameters: q (title or author), isbn, limit, offset.
func SearchCatalog(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))
	isbn := strings.TrimSpace(c.Query("isbn"))
	if q == "" && isbn == "" {
		return c.JSON([]CatalogHit{})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if offset < 0 {
		offset = 0
	}

	tx := database.DB.Model(&models.Edition{}).
		// Scope the projection to the editions table: the author/work joins
		// below repeat column names (id, title, title_key), and a bare SELECT *
		// lets those overwrite the edition's own fields when scanning.
		Select("editions.*").
		// Editions merged away as duplicates must not resurface.
		Where("editions.merged_into_id IS NULL")

	if isbn != "" {
		if norm := catalog.ISBN13(isbn); norm != "" {
			tx = tx.Where("editions.isbn13 = ?", norm)
		} else {
			// Not a valid ISBN — nothing can match it.
			return c.JSON([]CatalogHit{})
		}
	}

	if q != "" {
		// Match against the normalized keys so a search for "dede qorqud"
		// finds "Kitabi-Dədə Qorqud".
		key := catalog.NormalizeKey(q)
		if key == "" {
			return c.JSON([]CatalogHit{})
		}
		like := "%" + key + "%"
		tx = tx.
			Joins("LEFT JOIN works ON works.id = editions.work_id").
			Joins("LEFT JOIN catalog_authors ON catalog_authors.id = works.author_id").
			Where("editions.title_key LIKE ? OR works.title_key LIKE ? OR catalog_authors.name_key LIKE ?",
				like, like, like)
	}

	var editions []models.Edition
	if err := tx.
		Preload("Work").
		Preload("Work.Author").
		Preload("Publisher").
		Order("editions.title asc").
		Limit(limit).Offset(offset).
		Find(&editions).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Catalog search failed"})
	}

	hits := buildCatalogHits(c, editions)
	return c.JSON(hits)
}

// buildCatalogHits decorates editions with holding counts and whether the
// caller's own branch already stocks them.
func buildCatalogHits(c *fiber.Ctx, editions []models.Edition) []CatalogHit {
	hits := make([]CatalogHit, 0, len(editions))
	if len(editions) == 0 {
		return hits
	}

	ids := make([]uint, 0, len(editions))
	for _, e := range editions {
		ids = append(ids, e.ID)
	}

	// How many branches stock each edition, anywhere.
	type countRow struct {
		EditionID uint
		N         int
	}
	var counts []countRow
	database.DB.Model(&models.Book{}).
		Select("edition_id as edition_id, count(*) as n").
		Where("edition_id IN ?", ids).
		Group("edition_id").
		Scan(&counts)
	countBy := map[uint]int{}
	for _, r := range counts {
		countBy[r.EditionID] = r.N
	}

	// Which of them the caller's own branch already holds. A caller without a
	// branch (an admin) simply gets no "already held" flags.
	mine := map[uint]uint{}
	if branchID, err := getUserBranchID(c); err == nil {
		var own []models.Book
		database.DB.Select("id, edition_id").
			Where("branch_id = ? AND edition_id IN ?", branchID, ids).
			Find(&own)
		for _, b := range own {
			if b.EditionID != nil {
				mine[*b.EditionID] = b.ID
			}
		}
	}

	for _, e := range editions {
		h := CatalogHit{
			EditionID:       e.ID,
			WorkID:          e.WorkID,
			Title:           e.Title,
			WorkTitle:       e.Work.Title,
			AuthorName:      e.Work.Author.Name,
			PublisherName:   e.Publisher.Name,
			ISBN13:          e.ISBN13,
			Language:        e.Language,
			PublicationYear: e.PublicationYear,
			PageCount:       e.PageCount,
			CoverURL:        e.CoverURL,
			CEFRLevel:       e.CEFRLevel,
			EditionLabel:    e.EditionLabel,
			HoldingCount:    countBy[e.ID],
		}
		if bookID, ok := mine[e.ID]; ok {
			h.AlreadyHeld = true
			h.LocalBookID = &bookID
		}
		hits = append(hits, h)
	}
	return hits
}

// GetEdition returns one catalog edition with its work, for the book detail
// page and for confirming a match before a librarian commits to it.
func GetEdition(c *fiber.Ctx) error {
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil || id <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid edition id"})
	}

	var e models.Edition
	if err := database.DB.
		Preload("Work").
		Preload("Work.Author").
		Preload("Publisher").
		First(&e, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Edition not found"})
	}

	// Follow a merge pointer so old ids keep working after a duplicate is
	// folded into its survivor.
	for hops := 0; e.MergedIntoID != nil && hops < 10; hops++ {
		var next models.Edition
		if err := database.DB.
			Preload("Work").
			Preload("Work.Author").
			Preload("Publisher").
			First(&next, *e.MergedIntoID).Error; err != nil {
			break
		}
		e = next
	}

	hits := buildCatalogHits(c, []models.Edition{e})
	if len(hits) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Edition not found"})
	}
	return c.JSON(hits[0])
}
