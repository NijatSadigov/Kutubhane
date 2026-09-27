package catalog

import (
	"fmt"

	"school-library-system/models"

	"gorm.io/gorm"
)

// EditionInput is the bibliographic description of a book as a human typed it:
// what a librarian fills into the book form, or what an old branch-scoped Book
// row carries. Resolve turns it into a shared catalog Edition.
type EditionInput struct {
	Title           string
	AuthorName      string
	PublisherName   string
	ISBN            string
	Language        string
	EditionLabel    string
	CoverURL        string
	CEFRLevel       string
	PublicationYear int
	PageCount       int
}

// How an edition was arrived at. Useful for reporting and for telling a
// librarian "we matched this to a book already in the catalog".
const (
	MatchedByISBN    = "isbn"    // hard identifier, highest confidence
	MatchedByExact   = "exact"   // title + publisher + year + language all agree
	MatchedByRelaxed = "relaxed" // agreed except one side had no publisher
	MatchedByCreated = "created" // nothing matched; a new edition was made
)

// MatchInfo explains what Resolve did, so callers can report it and a curator
// can review the weaker matches.
type MatchInfo struct {
	MatchedBy      string
	EditionCreated bool
	WorkCreated    bool
	// WorkMatchedOnTitleAlone is set when a work was reused purely on its title
	// because no author was recorded — a weaker inference worth reviewing.
	WorkMatchedOnTitleAlone bool
	// Ambiguity is non-empty when matching found several equally good candidates
	// and refused to guess between them.
	Ambiguity string
}

// Resolve finds the shared Edition that an input describes, creating the
// Edition — and its Work, author and publisher — when nothing matches.
//
// It must be called inside a transaction when the caller needs atomicity. Rows
// it creates are visible to later calls in the same transaction, so a bulk
// import stays consistent with itself.
//
// Matching runs strongest-first:
//
//  1. ISBN-13, converted from ISBN-10 where needed. A hard identifier.
//  2. Exact: normalized title + publisher + year + language.
//  3. Relaxed: normalized title + year + language, where one side recorded no
//     publisher. Accepted only when exactly one candidate fits — several
//     candidates means the data cannot distinguish them, so it refuses and says
//     so rather than fusing two genuinely different editions.
func Resolve(tx *gorm.DB, in EditionInput) (*models.Edition, MatchInfo, error) {
	var info MatchInfo

	authorID, err := findOrCreateAuthor(tx, in.AuthorName)
	if err != nil {
		return nil, info, err
	}
	publisherID, err := findOrCreatePublisher(tx, in.PublisherName)
	if err != nil {
		return nil, info, err
	}

	titleKey := NormalizeKey(in.Title)
	langKey := NormalizeLanguage(in.Language)
	isbn13 := ISBN13(in.ISBN)

	// --- 1. ISBN ---
	if isbn13 != "" {
		var e models.Edition
		if err := tx.Where("isbn13 = ?", isbn13).First(&e).Error; err == nil {
			info.MatchedBy = MatchedByISBN
			return &e, info, nil
		} else if err != gorm.ErrRecordNotFound {
			return nil, info, err
		}
	}

	// --- 2. exact ---
	{
		q := tx.Where("title_key = ? AND publication_year = ? AND language_key = ?",
			titleKey, in.PublicationYear, langKey)
		if publisherID == nil {
			q = q.Where("publisher_id IS NULL")
		} else {
			q = q.Where("publisher_id = ?", *publisherID)
		}
		var e models.Edition
		if err := q.First(&e).Error; err == nil {
			info.MatchedBy = MatchedByExact
			return &e, info, nil
		} else if err != gorm.ErrRecordNotFound {
			return nil, info, err
		}
	}

	// --- 3. relaxed: one side never recorded a publisher ---
	{
		q := tx.Where("title_key = ? AND publication_year = ? AND language_key = ?",
			titleKey, in.PublicationYear, langKey)
		if publisherID != nil {
			// Our side knows the publisher, so only consider candidates that
			// don't. (A candidate that names a *different* publisher is a
			// genuinely different edition and must not match.)
			q = q.Where("publisher_id IS NULL")
		}
		var candidates []models.Edition
		if err := q.Limit(2).Find(&candidates).Error; err != nil {
			return nil, info, err
		}
		switch len(candidates) {
		case 1:
			info.MatchedBy = MatchedByRelaxed
			return &candidates[0], info, nil
		case 0:
		default:
			info.Ambiguity = fmt.Sprintf(
				"several editions match %q on title, year and language but differ on publisher — left unmerged",
				in.Title)
		}
	}

	// --- nothing matched: find or create the work, then the edition ---
	work, workInfo, err := findOrCreateWork(tx, in.Title, titleKey, in.AuthorName, authorID, in.PublicationYear)
	if err != nil {
		return nil, info, err
	}
	info.WorkCreated = workInfo.created
	info.WorkMatchedOnTitleAlone = workInfo.matchedOnTitleAlone
	if workInfo.ambiguity != "" && info.Ambiguity == "" {
		info.Ambiguity = workInfo.ambiguity
	}

	edition := models.Edition{
		WorkID:          work.ID,
		Title:           in.Title,
		TitleKey:        titleKey,
		LanguageKey:     langKey,
		ISBN13:          isbn13,
		PublisherID:     publisherID,
		PublicationYear: in.PublicationYear,
		EditionLabel:    in.EditionLabel,
		Language:        in.Language,
		PageCount:       in.PageCount,
		CoverURL:        in.CoverURL,
		CEFRLevel:       in.CEFRLevel,
	}
	if n := NormalizeISBN(in.ISBN); len(n) == 10 {
		edition.ISBN10 = n
	}
	if err := tx.Create(&edition).Error; err != nil {
		return nil, info, fmt.Errorf("create edition %q: %w", in.Title, err)
	}
	info.MatchedBy = MatchedByCreated
	info.EditionCreated = true
	return &edition, info, nil
}

type workMatch struct {
	created             bool
	matchedOnTitleAlone bool
	ambiguity           string
}

func findOrCreateWork(tx *gorm.DB, title, titleKey, authorName string, authorID *uint, year int) (*models.Work, workMatch, error) {
	var m workMatch
	matchKey := WorkMatchKey(title, authorName)

	var w models.Work
	if err := tx.Where("match_key = ?", matchKey).First(&w).Error; err == nil {
		return &w, m, nil
	} else if err != gorm.ErrRecordNotFound {
		return nil, m, err
	}

	// No author recorded. Reuse an existing work with this exact title when
	// there is exactly one — otherwise two branches cataloguing the same novel
	// end up with split reviews. More than one candidate is genuinely
	// ambiguous, so don't guess.
	if authorName == "" {
		var candidates []models.Work
		if err := tx.Where("title_key = ?", titleKey).Limit(2).Find(&candidates).Error; err != nil {
			return nil, m, err
		}
		switch len(candidates) {
		case 1:
			m.matchedOnTitleAlone = true
			return &candidates[0], m, nil
		case 0:
		default:
			m.ambiguity = fmt.Sprintf(
				"several works share the title %q and no author was recorded — created a new one", title)
		}
	}

	w = models.Work{
		Title:              title,
		TitleKey:           titleKey,
		AuthorID:           authorID,
		MatchKey:           matchKey,
		FirstPublishedYear: year,
	}
	if err := tx.Create(&w).Error; err != nil {
		return nil, m, fmt.Errorf("create work %q: %w", title, err)
	}
	m.created = true
	return &w, m, nil
}

func findOrCreateAuthor(tx *gorm.DB, name string) (*uint, error) {
	if NormalizeKey(name) == "" {
		return nil, nil
	}
	key := NormalizeKey(name)
	var a models.CatalogAuthor
	if err := tx.Where("name_key = ?", key).First(&a).Error; err == nil {
		return &a.ID, nil
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	a = models.CatalogAuthor{Name: name, NameKey: key}
	if err := tx.Create(&a).Error; err != nil {
		return nil, fmt.Errorf("create author %q: %w", name, err)
	}
	return &a.ID, nil
}

func findOrCreatePublisher(tx *gorm.DB, name string) (*uint, error) {
	if NormalizeKey(name) == "" {
		return nil, nil
	}
	key := NormalizeKey(name)
	var p models.CatalogPublisher
	if err := tx.Where("name_key = ?", key).First(&p).Error; err == nil {
		return &p.ID, nil
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}
	p = models.CatalogPublisher{Name: name, NameKey: key}
	if err := tx.Create(&p).Error; err != nil {
		return nil, fmt.Errorf("create publisher %q: %w", name, err)
	}
	return &p.ID, nil
}

// Reindex recomputes the normalized match keys on every catalog row. It is
// needed once after the key columns are introduced, and is harmless to re-run:
// rows whose keys are already correct are left alone.
func Reindex(db *gorm.DB) (int, error) {
	updated := 0

	var authors []models.CatalogAuthor
	if err := db.Find(&authors).Error; err != nil {
		return updated, err
	}
	for _, a := range authors {
		if k := NormalizeKey(a.Name); k != a.NameKey {
			if err := db.Model(&models.CatalogAuthor{}).Where("id = ?", a.ID).
				Update("name_key", k).Error; err != nil {
				return updated, err
			}
			updated++
		}
	}

	var pubs []models.CatalogPublisher
	if err := db.Find(&pubs).Error; err != nil {
		return updated, err
	}
	for _, p := range pubs {
		if k := NormalizeKey(p.Name); k != p.NameKey {
			if err := db.Model(&models.CatalogPublisher{}).Where("id = ?", p.ID).
				Update("name_key", k).Error; err != nil {
				return updated, err
			}
			updated++
		}
	}

	// Works need the author's name to rebuild their match key.
	var works []models.Work
	if err := db.Preload("Author").Find(&works).Error; err != nil {
		return updated, err
	}
	for _, w := range works {
		authorName := ""
		if w.AuthorID != nil {
			authorName = w.Author.Name
		}
		tk, mk := NormalizeKey(w.Title), WorkMatchKey(w.Title, authorName)
		if tk != w.TitleKey || mk != w.MatchKey {
			if err := db.Model(&models.Work{}).Where("id = ?", w.ID).
				Updates(map[string]any{"title_key": tk, "match_key": mk}).Error; err != nil {
				return updated, err
			}
			updated++
		}
	}

	var editions []models.Edition
	if err := db.Find(&editions).Error; err != nil {
		return updated, err
	}
	for _, e := range editions {
		tk, lk := NormalizeKey(e.Title), NormalizeLanguage(e.Language)
		if tk != e.TitleKey || lk != e.LanguageKey {
			if err := db.Model(&models.Edition{}).Where("id = ?", e.ID).
				Updates(map[string]any{"title_key": tk, "language_key": lk}).Error; err != nil {
				return updated, err
			}
			updated++
		}
	}

	return updated, nil
}
