package models

import "time"

// ==========================================
// GLOBAL CATALOG (shared across every branch, school and organization)
// ==========================================
//
// The catalog has four levels:
//
//	Work     — the abstract creation ("Əli və Nino" by Qurban Səid). GLOBAL.
//	Edition  — one published manifestation of it (a specific ISBN, publisher,
//	           year, language, page count, cover). GLOBAL.
//	Book     — a branch's decision to stock an Edition: call number, local
//	           classification, local notes. BRANCH-SCOPED (see liblary.go).
//	BookCopy — the physical object on the shelf, with its own barcode.
//
// Ratings and reviews attach to the Work, so activity aggregates across
// translations and reprints. Reading progress attaches through the Book to the
// Edition, so page numbers mean something.
//
// Work and Edition rows are shared by everyone, so they are read-only to
// librarians: a branch's local deviations belong on its Book row, never here.

// CatalogAuthor is a writer in the global catalog. Distinct from the
// branch-scoped Author in liblary.go, which is a local classification list —
// who wrote a book is a fact, not a shelving decision.
type CatalogAuthor struct {
	ID   uint   `json:"id" gorm:"primaryKey"`
	Name string `json:"name" gorm:"index"`
	// NameKey is Name normalized for matching (lowercased, punctuation and
	// diacritics folded). Used to find duplicates on import.
	NameKey   string    `json:"name_key" gorm:"index"`
	CreatedAt time.Time `json:"created_at"`
}

// CatalogPublisher is a publishing house in the global catalog.
type CatalogPublisher struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"index"`
	NameKey   string    `json:"name_key" gorm:"index"`
	CreatedAt time.Time `json:"created_at"`
}

// Work is the abstract book — the thing a reader means when they say they read
// "Əli və Nino", regardless of which translation or printing they held.
// Reviews, ratings and lists attach here.
type Work struct {
	ID uint `json:"id" gorm:"primaryKey"`

	Title         string `json:"title" gorm:"index"`
	OriginalTitle string `json:"original_title"`
	Description   string `json:"description"`

	AuthorID *uint         `json:"author_id"`
	Author   CatalogAuthor `json:"author" gorm:"foreignKey:AuthorID"`

	FirstPublishedYear int `json:"first_published_year"`

	// MatchKey is normalized "title|author" used to spot duplicates when a
	// librarian creates a work that probably already exists. TitleKey is the
	// normalized title on its own, for the weaker match used when no author was
	// recorded. Both are maintained by the catalog package — never set by hand.
	MatchKey string `json:"match_key" gorm:"index"`
	TitleKey string `json:"title_key" gorm:"index"`

	// MergedIntoID points at the surviving Work when this one is merged away as
	// a duplicate. Old ids keep resolving instead of 404ing.
	MergedIntoID *uint `json:"merged_into_id"`

	Editions []Edition `json:"editions,omitempty" gorm:"foreignKey:WorkID"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Edition is one published version of a Work: a specific ISBN, publisher, year,
// language, page count and cover. Bibliographic facts live here.
type Edition struct {
	ID uint `json:"id" gorm:"primaryKey"`

	WorkID uint `json:"work_id" gorm:"index"`
	Work   Work `json:"work,omitempty" gorm:"foreignKey:WorkID"`

	// Title as printed on this edition, which may differ from the Work's
	// canonical title (a translation, a retitled reprint).
	Title string `json:"title" gorm:"index"`

	// Normalized forms used for duplicate detection. Maintained by the catalog
	// package; never set these by hand.
	TitleKey    string `json:"title_key" gorm:"index"`
	LanguageKey string `json:"language_key" gorm:"index"`

	ISBN13 string `json:"isbn13" gorm:"index"`
	ISBN10 string `json:"isbn10" gorm:"index"`

	PublisherID *uint            `json:"publisher_id"`
	Publisher   CatalogPublisher `json:"publisher" gorm:"foreignKey:PublisherID"`

	PublicationYear int    `json:"publication_year"`
	EditionLabel    string `json:"edition_label"` // "2nd edition", "revised"
	Language        string `json:"language"`
	PageCount       int    `json:"page_count"`
	CoverURL        string `json:"cover_url"`
	Format          string `json:"format"`     // PAPERBACK, HARDCOVER, EBOOK, AUDIO
	CEFRLevel       string `json:"cefr_level"` // graded readers print this on the book

	// External identifiers, so imports are idempotent and dedup has something
	// solid to match on.
	OpenLibraryID string `json:"open_library_id" gorm:"index"`
	GoogleBooksID string `json:"google_books_id" gorm:"index"`

	MergedIntoID *uint `json:"merged_into_id"`

	// HoldingCount is how many branches stock this edition. Computed via
	// subquery; read-only, not a real column.
	HoldingCount int `json:"holding_count" gorm:"->;-:migration"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
