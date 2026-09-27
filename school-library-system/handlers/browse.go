package handlers

import (
	"sort"
	"strings"
	"time"

	"school-library-system/catalog"
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// BrowseCard is one book as the reader-facing catalogue grid needs it: the
// bibliographic facts from the shared catalogue, plus how the caller's own
// branch relates to it (do we hold it, is a copy free right now).
//
// This is the contract the myredbookshelf Catalogue screen consumes.
type BrowseCard struct {
	EditionID uint  `json:"edition_id"`
	WorkID    uint  `json:"work_id"`
	BookID    *uint `json:"book_id,omitempty"` // the caller's holding, when held

	Title     string `json:"title"`
	Author    string `json:"author"`
	Publisher string `json:"publisher"`
	Year      int    `json:"year"`
	Pages     int    `json:"pages"`
	ISBN      string `json:"isbn"`
	Language  string `json:"language"`
	LangCode  string `json:"lang_code"`
	CEFR      string `json:"cefr"`
	Genre     string `json:"genre"`
	CoverURL  string `json:"cover_url"`

	// Synopsis is the blurb the book page sets in Source Serif under the
	// title. It is a fact about the work, not about a branch's copy, so it
	// comes off Work.Description; nothing writes it yet, and the page simply
	// omits the paragraph when it is empty rather than inventing one.
	Synopsis string `json:"synopsis"`

	// Availability, from the caller's own branch.
	HeldHere        bool `json:"held_here"`
	Copies          int  `json:"copies"`
	AvailableCopies int  `json:"available_copies"`
	// OtherBranches is how many other branches hold this edition — drives the
	// "also at 2 other branches" note on the book page.
	OtherBranches int `json:"other_branches"`

	// Ratings are part of the social layer, which does not exist yet. They are
	// returned as nulls rather than zeros so the UI can say "no ratings yet"
	// instead of showing a misleading 0.0.
	Rating       *float64 `json:"rating"`
	RatingsCount int      `json:"ratings_count"`

	// What this reader is already doing with the book. Without it the card
	// cannot tell "you can borrow this" from "you already have it", and every
	// book offers the same Reserve button however many times you press it.
	//
	//	""                 nothing going on
	//	ON_LOAN            it is in their bag right now
	//	RESERVED_PENDING   waiting for the desk to approve
	//	RESERVED_READY     approved, waiting to be collected
	MyStatus         string     `json:"my_status"`
	MyDueDate        *time.Time `json:"my_due_date"`
	MyPickupDeadline *time.Time `json:"my_pickup_deadline"`
	MyReservationID  *uint      `json:"my_reservation_id"`
	// MyLoanID is the open loan behind MyStatus ON_LOAN. A diary entry is
	// written against a loan, so the book page needs it to offer the design's
	// "log today's reading" button.
	MyLoanID *uint `json:"my_loan_id"`

	// ShelfStatus is OWNED / WANT / READING / READ when the book is on their
	// shelf; IsFavorite is independent of it.
	ShelfStatus string `json:"shelf_status"`
	IsFavorite  bool   `json:"is_favorite"`

	// BorrowCount is how many times this edition has ever been lent, across
	// every branch. It is what "Most borrowed" in the design's sort menu means;
	// counting copies instead made a title with three copies and no readers
	// outrank one that had been read forty times.
	BorrowCount int `json:"borrow_count"`
}

// BrowseCatalogue backs the reader-facing Catalogue screen.
//
// Scopes, the three the design's segmented control offers:
//
//	shelf   — only works on the caller's own shelf, whatever their status
//	library — everything the caller's own branch holds (the default)
//	global  — the whole shared catalogue, including titles no branch here holds
func BrowseCatalogue(c *fiber.Ctx) error {
	scope := c.Query("scope", "library")

	branchID, branchErr := getUserBranchID(c)

	// --- gather the editions in scope ---
	var editions []models.Edition
	holdingByEdition := map[uint]*models.Book{}

	if scope == "shelf" {
		ids, err := shelfEditionIDs(c)
		if err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
		}
		if len(ids) > 0 {
			q := database.DB.Model(&models.Edition{}).
				Select("editions.*").
				Where("editions.id IN ?", ids)
			q = applyBrowseFilters(c, q)
			if err := q.Preload("Work").Preload("Work.Author").Preload("Publisher").
				Find(&editions).Error; err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Catalogue query failed"})
			}
		}
		// The reader's own branch still decides availability and the borrow
		// action, exactly as in the other two scopes.
		if branchErr == nil {
			var own []models.Book
			database.DB.
				Preload("Genre").Preload("Copies").Preload("Copies.Status").
				Where("branch_id = ?", branchID).
				Find(&own)
			for i := range own {
				if own[i].EditionID != nil {
					holdingByEdition[*own[i].EditionID] = &own[i]
				}
			}
		}
	} else if scope == "global" {
		q := database.DB.Model(&models.Edition{}).
			Select("editions.*").
			Where("editions.merged_into_id IS NULL")
		q = applyBrowseFilters(c, q)
		if err := q.Preload("Work").Preload("Work.Author").Preload("Publisher").
			Find(&editions).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Catalogue query failed"})
		}
	} else {
		if branchErr != nil {
			return c.Status(401).JSON(fiber.Map{"error": branchErr.Error()})
		}
		var books []models.Book
		if err := database.DB.
			Preload("Genre").Preload("Author").Preload("Publisher").
			Preload("Copies").Preload("Copies.Status").
			Where("branch_id = ?", branchID).
			Find(&books).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Catalogue query failed"})
		}
		ids := make([]uint, 0, len(books))
		for i := range books {
			if books[i].EditionID != nil {
				holdingByEdition[*books[i].EditionID] = &books[i]
				ids = append(ids, *books[i].EditionID)
			}
		}
		if len(ids) > 0 {
			q := database.DB.Model(&models.Edition{}).
				Select("editions.*").
				Where("editions.id IN ?", ids)
			q = applyBrowseFilters(c, q)
			if err := q.Preload("Work").Preload("Work.Author").Preload("Publisher").
				Find(&editions).Error; err != nil {
				return c.Status(500).JSON(fiber.Map{"error": "Catalogue query failed"})
			}
		}
	}

	if len(editions) == 0 {
		return c.JSON(fiber.Map{"total": 0, "items": []BrowseCard{}})
	}

	// --- availability for the caller's branch, and holdings elsewhere ---
	editionIDs := make([]uint, 0, len(editions))
	for _, e := range editions {
		editionIDs = append(editionIDs, e.ID)
	}

	if scope == "global" && branchErr == nil {
		var own []models.Book
		database.DB.
			Preload("Genre").Preload("Copies").Preload("Copies.Status").
			Where("branch_id = ? AND edition_id IN ?", branchID, editionIDs).
			Find(&own)
		for i := range own {
			if own[i].EditionID != nil {
				holdingByEdition[*own[i].EditionID] = &own[i]
			}
		}
	}

	// How many branches in total hold each edition.
	type cnt struct {
		EditionID uint
		N         int
	}
	var counts []cnt
	database.DB.Model(&models.Book{}).
		Select("edition_id as edition_id, count(*) as n").
		Where("edition_id IN ?", editionIDs).
		Group("edition_id").Scan(&counts)
	holdingCount := map[uint]int{}
	for _, r := range counts {
		holdingCount[r.EditionID] = r.N
	}

	// How many times each edition has ever been lent, across every branch —
	// what the design's "Most borrowed" sort actually orders by.
	var borrowRows []cnt
	database.DB.Model(&models.Loan{}).
		Select("books.edition_id as edition_id, count(*) as n").
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.edition_id IN ?", editionIDs).
		Group("books.edition_id").Scan(&borrowRows)
	borrowCount := map[uint]int{}
	for _, r := range borrowRows {
		borrowCount[r.EditionID] = r.N
	}

	// --- ratings, per work, in one query ---
	workIDs := make([]uint, 0, len(editions))
	for _, e := range editions {
		workIDs = append(workIDs, e.WorkID)
	}
	type ratingRow struct {
		WorkID uint
		Avg    float64
		N      int
	}
	var ratingRows []ratingRow
	database.DB.Model(&models.Review{}).
		Select("work_id as work_id, AVG(rating) as avg, COUNT(*) as n").
		Where("work_id IN ? AND hidden = false", workIDs).
		Group("work_id").Scan(&ratingRows)
	ratingBy := map[uint]ratingRow{}
	for _, r := range ratingRows {
		ratingBy[r.WorkID] = r
	}

	// --- what this reader is already doing with each book ---
	type myState struct {
		status   string
		due      *time.Time
		deadline *time.Time
		resID    *uint
		loanID   *uint
	}
	mine := map[uint]myState{}   // keyed by branch book (holding) id
	shelfBy := map[uint]string{} // keyed by work id
	favBy := map[uint]bool{}

	if uid, err := currentUserID(c); err == nil {
		// Active loans — a book in their bag is not one to borrow again.
		var loans []models.Loan
		database.DB.
			Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
			Where("loans.student_id = ? AND loans.return_date IS NULL", uid).
			Preload("BookCopy").
			Find(&loans)
		for i := range loans {
			due := loans[i].DueDate
			id := loans[i].ID
			mine[loans[i].BookCopy.BookID] = myState{status: "ON_LOAN", due: &due, loanID: &id}
		}

		// Open reservations, pending or approved.
		var held []models.Reservation
		database.DB.
			Joins("JOIN reservation_statuses ON reservation_statuses.id = reservations.status_id").
			Where("reservations.student_id = ? AND reservation_statuses.code IN ?",
				uid, []string{"PENDING", "APPROVED"}).
			Preload("Status").Preload("BookCopy").
			Find(&held)
		for i := range held {
			r := held[i]
			st := "RESERVED_PENDING"
			if r.Status.Code == "APPROVED" {
				st = "RESERVED_READY"
			}
			id := r.ID
			// A loan already recorded wins: it is the stronger fact.
			if cur, ok := mine[r.BookCopy.BookID]; ok && cur.status == "ON_LOAN" {
				continue
			}
			mine[r.BookCopy.BookID] = myState{status: st, deadline: r.PickupDeadline, resID: &id}
		}

		// Shelf, which is keyed by work rather than by a branch's copy.
		var shelf []models.ShelfItem
		database.DB.Where("user_id = ?", uid).Find(&shelf)
		for _, it := range shelf {
			shelfBy[it.WorkID] = it.Status
			favBy[it.WorkID] = it.Favorite
		}
	}

	// --- build the cards ---
	cards := make([]BrowseCard, 0, len(editions))
	for _, e := range editions {
		card := BrowseCard{
			EditionID: e.ID,
			WorkID:    e.WorkID,
			Title:     e.Title,
			Author:    e.Work.Author.Name,
			Publisher: e.Publisher.Name,
			Year:      e.PublicationYear,
			Pages:     e.PageCount,
			ISBN:      e.ISBN13,
			Language:  e.Language,
			LangCode:  e.LanguageKey,
			CEFR:      e.CEFRLevel,
			CoverURL:  e.CoverURL,
			Synopsis:  e.Work.Description,
		}
		if card.Title == "" {
			card.Title = e.Work.Title
		}

		if h, ok := holdingByEdition[e.ID]; ok {
			card.HeldHere = true
			id := h.ID
			card.BookID = &id
			card.Genre = h.Genre.Name
			if card.CoverURL == "" {
				card.CoverURL = h.CoverURL
			}
			card.Copies = len(h.Copies)
			for _, cp := range h.Copies {
				if cp.Status.Code == "AVAILABLE" {
					card.AvailableCopies++
				}
			}
		}
		card.ShelfStatus = shelfBy[e.WorkID]
		card.IsFavorite = favBy[e.WorkID]
		if card.BookID != nil {
			if st, ok := mine[*card.BookID]; ok {
				card.MyStatus = st.status
				card.MyDueDate = st.due
				card.MyPickupDeadline = st.deadline
				card.MyReservationID = st.resID
				card.MyLoanID = st.loanID
			}
		}
		if r, ok := ratingBy[e.WorkID]; ok && r.N > 0 {
			avg := float64(int(r.Avg*10+0.5)) / 10
			card.Rating = &avg
			card.RatingsCount = r.N
		}
		if n := holdingCount[e.ID]; n > 0 {
			card.OtherBranches = n
			if card.HeldHere {
				card.OtherBranches = n - 1
			}
		}
		card.BorrowCount = borrowCount[e.ID]

		cards = append(cards, card)
	}

	// "Available at my library" is a property of the holding, so it is applied
	// after availability has been computed rather than in SQL.
	if c.Query("available") == "true" {
		kept := cards[:0]
		for _, card := range cards {
			if card.AvailableCopies > 0 {
				kept = append(kept, card)
			}
		}
		cards = kept
	}
	if g := strings.TrimSpace(c.Query("genre")); g != "" {
		wanted := map[string]bool{}
		for _, name := range strings.Split(g, ",") {
			wanted[catalog.NormalizeKey(name)] = true
		}
		kept := cards[:0]
		for _, card := range cards {
			if wanted[catalog.NormalizeKey(card.Genre)] {
				kept = append(kept, card)
			}
		}
		cards = kept
	}

	sortBrowseCards(cards, c.Query("sort", "title"))
	return c.JSON(fiber.Map{"total": len(cards), "items": cards})
}

// applyBrowseFilters adds the filters that can be expressed in SQL against the
// editions table. Genre and availability live on the holding, so those are
// applied afterwards in Go.
func applyBrowseFilters(c *fiber.Ctx, q *gorm.DB) *gorm.DB {
	if s := strings.TrimSpace(c.Query("q")); s != "" {
		key := catalog.NormalizeKey(s)
		if key != "" {
			like := "%" + key + "%"
			q = q.
				Joins("LEFT JOIN works ON works.id = editions.work_id").
				Joins("LEFT JOIN catalog_authors ON catalog_authors.id = works.author_id").
				Where("editions.title_key LIKE ? OR works.title_key LIKE ? OR catalog_authors.name_key LIKE ?",
					like, like, like)
		}
	}

	// CEFR chips: any of the selected levels.
	if s := strings.TrimSpace(c.Query("cefr")); s != "" {
		q = q.Where("editions.cefr_level IN ?", strings.Split(s, ","))
	}

	// Edition language chips are ISO codes, matched against the normalized key
	// so "az" finds rows recorded as "Azərbaycan".
	if s := strings.TrimSpace(c.Query("lang")); s != "" {
		codes := []string{}
		for _, v := range strings.Split(s, ",") {
			if code := catalog.NormalizeLanguage(v); code != "" {
				codes = append(codes, code)
			}
		}
		if len(codes) > 0 {
			q = q.Where("editions.language_key IN ?", codes)
		}
	}

	// Length chips: under 200 / 200–350 / 350+.
	switch c.Query("len") {
	case "short":
		q = q.Where("editions.page_count > 0 AND editions.page_count < 200")
	case "mid":
		q = q.Where("editions.page_count BETWEEN 200 AND 350")
	case "long":
		q = q.Where("editions.page_count > 350")
	}

	return q
}

// sortBrowseCards orders the grid. The mode names are the four the design's
// sort menu offers — popular / rating / newest / title; "borrowed" is kept as
// an alias because the first build of the screen sent that.
func sortBrowseCards(cards []BrowseCard, mode string) {
	switch mode {
	case "popular", "borrowed":
		sort.SliceStable(cards, func(i, j int) bool {
			if cards[i].BorrowCount != cards[j].BorrowCount {
				return cards[i].BorrowCount > cards[j].BorrowCount
			}
			// Never borrowed either way: the better-stocked title goes first.
			return cards[i].Copies > cards[j].Copies
		})
	case "rating":
		// Unrated titles sink to the bottom rather than sorting as zero, and a
		// rating backed by more reviews wins a tie.
		sort.SliceStable(cards, func(i, j int) bool {
			a, b := cards[i].Rating, cards[j].Rating
			if (a == nil) != (b == nil) {
				return a != nil
			}
			if a != nil && *a != *b {
				return *a > *b
			}
			return cards[i].RatingsCount > cards[j].RatingsCount
		})
	case "newest":
		sort.SliceStable(cards, func(i, j int) bool { return cards[i].Year > cards[j].Year })
	default: // title A–Z, collated for Azerbaijani
		sort.SliceStable(cards, func(i, j int) bool {
			return catalog.NormalizeKey(cards[i].Title) < catalog.NormalizeKey(cards[j].Title)
		})
	}
}

// shelfEditionIDs resolves the caller's shelf to a set of edition ids, so the
// "My shelf" scope can be browsed and filtered with the same machinery as the
// other two. A shelf item records the edition the reader shelved when they
// said so; for the ones that only name a work, any live edition of it stands
// in, because the reader means the book rather than a particular printing.
func shelfEditionIDs(c *fiber.Ctx) ([]uint, error) {
	uid, err := currentUserID(c)
	if err != nil {
		return nil, err
	}

	var items []models.ShelfItem
	if err := database.DB.Where("user_id = ?", uid).Find(&items).Error; err != nil {
		return nil, err
	}

	ids := make([]uint, 0, len(items))
	var loose []uint // works shelved without an edition
	for _, it := range items {
		if it.EditionID != nil {
			ids = append(ids, *it.EditionID)
		} else {
			loose = append(loose, it.WorkID)
		}
	}

	if len(loose) > 0 {
		var stand []models.Edition
		database.DB.
			Where("work_id IN ? AND merged_into_id IS NULL", loose).
			Order("work_id, id").
			Find(&stand)
		seen := map[uint]bool{}
		for _, e := range stand {
			if !seen[e.WorkID] {
				seen[e.WorkID] = true
				ids = append(ids, e.ID)
			}
		}
	}
	return ids, nil
}
