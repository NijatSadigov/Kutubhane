package catalog

import (
	"fmt"
	"os"
	"testing"

	"school-library-system/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// These are integration tests: matching is mostly SQL predicates, so testing it
// against a real Postgres is the only way to test what actually runs. They use
// a dedicated throwaway database and never touch school_library.
//
// Override the server with TEST_DATABASE_DSN. When no Postgres is reachable the
// tests skip rather than fail, so `go test ./...` still works on a machine
// without one.

const testDBName = "school_library_catalogtest"

var testDB *gorm.DB

func TestMain(m *testing.M) {
	admin := os.Getenv("TEST_DATABASE_DSN")
	if admin == "" {
		admin = "host=localhost user=postgres password=2334 dbname=postgres port=5432 sslmode=disable"
	}

	root, err := gorm.Open(postgres.Open(admin), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		fmt.Fprintf(os.Stderr, "catalog integration tests skipped: no Postgres (%v)\n", err)
		os.Exit(0)
	}

	root.Exec("DROP DATABASE IF EXISTS " + testDBName)
	if err := root.Exec("CREATE DATABASE " + testDBName).Error; err != nil {
		fmt.Fprintf(os.Stderr, "catalog integration tests skipped: cannot create test db (%v)\n", err)
		os.Exit(0)
	}

	dsn := fmt.Sprintf("host=localhost user=postgres password=2334 dbname=%s port=5432 sslmode=disable", testDBName)
	if v := os.Getenv("TEST_DATABASE_DSN_TARGET"); v != "" {
		dsn = v
	}
	testDB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		fmt.Fprintf(os.Stderr, "catalog integration tests skipped: cannot open test db (%v)\n", err)
		os.Exit(0)
	}
	if err := testDB.AutoMigrate(
		&models.CatalogAuthor{}, &models.CatalogPublisher{},
		&models.Work{}, &models.Edition{},
	); err != nil {
		fmt.Fprintf(os.Stderr, "catalog integration tests skipped: migrate failed (%v)\n", err)
		os.Exit(0)
	}

	code := m.Run()

	if sql, err := testDB.DB(); err == nil {
		sql.Close()
	}
	root.Exec("DROP DATABASE IF EXISTS " + testDBName)
	os.Exit(code)
}

// fresh empties the catalog so each test starts from nothing.
func fresh(t *testing.T) *gorm.DB {
	t.Helper()
	if testDB == nil {
		t.Skip("no test database")
	}
	testDB.Exec("TRUNCATE editions, works, catalog_authors, catalog_publishers RESTART IDENTITY CASCADE")
	return testDB
}

func mustResolve(t *testing.T, db *gorm.DB, in EditionInput) (*models.Edition, MatchInfo) {
	t.Helper()
	ed, info, err := Resolve(db, in)
	if err != nil {
		t.Fatalf("Resolve(%q) failed: %v", in.Title, err)
	}
	return ed, info
}

func TestResolveCreatesThenReusesTheSameEdition(t *testing.T) {
	db := fresh(t)
	in := EditionInput{
		Title: "1984", AuthorName: "George Orwell", PublisherName: "Penguin",
		Language: "English", PublicationYear: 1949, PageCount: 328,
	}

	first, info1 := mustResolve(t, db, in)
	if !info1.EditionCreated || info1.MatchedBy != MatchedByCreated {
		t.Fatalf("first resolve should create: %+v", info1)
	}

	second, info2 := mustResolve(t, db, in)
	if info2.EditionCreated {
		t.Error("identical input created a second edition")
	}
	if second.ID != first.ID {
		t.Errorf("identical input resolved to edition %d, want %d", second.ID, first.ID)
	}
	if info2.MatchedBy != MatchedByExact {
		t.Errorf("MatchedBy = %q, want %q", info2.MatchedBy, MatchedByExact)
	}
}

func TestResolveMatchesOnISBNDespiteDifferentTitleSpelling(t *testing.T) {
	db := fresh(t)
	first, _ := mustResolve(t, db, EditionInput{
		Title: "Nineteen Eighty-Four", ISBN: "978-0-452-28423-4",
		AuthorName: "George Orwell", Language: "en", PublicationYear: 1949,
	})

	// Same ISBN typed without hyphens, title spelled differently: the hard
	// identifier must win.
	second, info := mustResolve(t, db, EditionInput{
		Title: "1984", ISBN: "9780452284234", Language: "en", PublicationYear: 1949,
	})
	if second.ID != first.ID {
		t.Errorf("ISBN match failed: got edition %d, want %d", second.ID, first.ID)
	}
	if info.MatchedBy != MatchedByISBN {
		t.Errorf("MatchedBy = %q, want %q", info.MatchedBy, MatchedByISBN)
	}
}

func TestResolveMatchesISBN10AgainstISBN13(t *testing.T) {
	db := fresh(t)
	first, _ := mustResolve(t, db, EditionInput{
		Title: "Some Book", ISBN: "0306406152", Language: "en", PublicationYear: 1980,
	})
	second, info := mustResolve(t, db, EditionInput{
		Title: "Some Book Reprinted", ISBN: "978-0-306-40615-7", Language: "en", PublicationYear: 1980,
	})
	if second.ID != first.ID {
		t.Errorf("ISBN-10/13 equivalence failed: got %d, want %d", second.ID, first.ID)
	}
	if info.MatchedBy != MatchedByISBN {
		t.Errorf("MatchedBy = %q, want %q", info.MatchedBy, MatchedByISBN)
	}
}

func TestResolveMergesWhenOneSideOmitsThePublisher(t *testing.T) {
	// The case that broke the first implementation: one branch records a
	// publisher, another leaves it blank.
	db := fresh(t)
	first, _ := mustResolve(t, db, EditionInput{
		Title: "1984", AuthorName: "George Orwell", PublisherName: "Penguin",
		Language: "en", PublicationYear: 1949,
	})
	second, info := mustResolve(t, db, EditionInput{
		Title: "1984", Language: "en", PublicationYear: 1949,
	})
	if second.ID != first.ID {
		t.Errorf("relaxed match failed: got edition %d, want %d", second.ID, first.ID)
	}
	if info.MatchedBy != MatchedByRelaxed {
		t.Errorf("MatchedBy = %q, want %q", info.MatchedBy, MatchedByRelaxed)
	}
}

func TestResolveKeepsDifferentPublishersApart(t *testing.T) {
	// Two publishers named explicitly are genuinely different editions and must
	// never be fused.
	db := fresh(t)
	a, _ := mustResolve(t, db, EditionInput{
		Title: "1984", PublisherName: "Penguin", Language: "en", PublicationYear: 1949,
	})
	b, _ := mustResolve(t, db, EditionInput{
		Title: "1984", PublisherName: "Secker and Warburg", Language: "en", PublicationYear: 1949,
	})
	if a.ID == b.ID {
		t.Error("editions from different publishers were wrongly merged")
	}
	if a.WorkID != b.WorkID {
		t.Errorf("two editions of one novel should share a work: %d vs %d", a.WorkID, b.WorkID)
	}
}

func TestResolveRefusesToGuessBetweenAmbiguousWorks(t *testing.T) {
	// Two works share a title but have different authors. An incoming book with
	// no author recorded cannot be assigned to either: it must create its own
	// and say why.
	db := fresh(t)
	mustResolve(t, db, EditionInput{Title: "Ambiguous", AuthorName: "Author One", Language: "en", PublicationYear: 1990})
	mustResolve(t, db, EditionInput{Title: "Ambiguous", AuthorName: "Author Two", Language: "en", PublicationYear: 1995})

	ed, info := mustResolve(t, db, EditionInput{Title: "Ambiguous", Language: "tr", PublicationYear: 2001})
	if info.Ambiguity == "" {
		t.Error("expected an ambiguity note when two works share a title and no author is given")
	}
	if !info.WorkCreated {
		t.Error("expected a new work rather than a guess")
	}
	if info.WorkMatchedOnTitleAlone {
		t.Error("must not claim a title-alone match when the title is ambiguous")
	}
	if ed.WorkID == 0 {
		t.Error("edition was not attached to a work")
	}
}

func TestResolveAttachesToSoleWorkWhenAuthorMissing(t *testing.T) {
	// Exactly one work with this title, and no author on the incoming record:
	// reusing it is the whole point, otherwise reviews split.
	db := fresh(t)
	first, _ := mustResolve(t, db, EditionInput{
		Title: "Unique Title", AuthorName: "Only Author", Language: "en", PublicationYear: 1990,
	})
	second, info := mustResolve(t, db, EditionInput{
		Title: "Unique Title", Language: "tr", PublicationYear: 2005,
	})
	if second.WorkID != first.WorkID {
		t.Errorf("should share work %d, got %d", first.WorkID, second.WorkID)
	}
	if !info.WorkMatchedOnTitleAlone {
		t.Error("expected WorkMatchedOnTitleAlone to be reported")
	}
	if !info.EditionCreated {
		t.Error("a different year/language is a different edition and should be created")
	}
}

func TestResolveTreatsHyphenatedAndSpacedTitlesAsOneBook(t *testing.T) {
	// The real-data case: "Kitabi-Dədə Qorqud" vs "Kitabi Dədə Qorqud".
	db := fresh(t)
	first, _ := mustResolve(t, db, EditionInput{
		Title: "Kitabi-Dədə Qorqud", AuthorName: "Anonim", Language: "az", PublicationYear: 1300,
	})
	second, info := mustResolve(t, db, EditionInput{
		Title: "Kitabi Dədə Qorqud", AuthorName: "Anonim", Language: "az", PublicationYear: 1300,
	})
	if second.ID != first.ID {
		t.Errorf("hyphen/space spellings produced different editions (%d vs %d)", first.ID, second.ID)
	}
	if info.EditionCreated {
		t.Error("the spaced spelling created a duplicate edition")
	}
}

func TestResolveTreatsLanguageVariantsAsTheSameLanguage(t *testing.T) {
	// Real data has both "az" and "Azərbaycan" for the same language. They must
	// not split one book into two editions.
	db := fresh(t)
	first, _ := mustResolve(t, db, EditionInput{
		Title: "Dede Qorqud", AuthorName: "Anonim", Language: "Azərbaycan", PublicationYear: 1300,
	})
	second, info := mustResolve(t, db, EditionInput{
		Title: "Dede Qorqud", AuthorName: "Anonim", Language: "az", PublicationYear: 1300,
	})
	if second.ID != first.ID {
		t.Errorf("language variants produced different editions (%d vs %d)", first.ID, second.ID)
	}
	if info.EditionCreated {
		t.Error("the 'az' spelling created a duplicate edition")
	}
}

func TestResolveReusesAuthorsAndPublishersAcrossCalls(t *testing.T) {
	db := fresh(t)
	mustResolve(t, db, EditionInput{
		Title: "Book A", AuthorName: "George Orwell", PublisherName: "Penguin",
		Language: "en", PublicationYear: 1945,
	})
	// Same people, spelled with different case and spacing.
	mustResolve(t, db, EditionInput{
		Title: "Book B", AuthorName: "george  ORWELL", PublisherName: "penguin",
		Language: "en", PublicationYear: 1949,
	})

	var authors, pubs int64
	db.Model(&models.CatalogAuthor{}).Count(&authors)
	db.Model(&models.CatalogPublisher{}).Count(&pubs)
	if authors != 1 {
		t.Errorf("got %d catalog authors, want 1", authors)
	}
	if pubs != 1 {
		t.Errorf("got %d catalog publishers, want 1", pubs)
	}
}

func TestResolveHandlesMissingAndEmptyFields(t *testing.T) {
	db := fresh(t)
	// A record with almost nothing on it must not panic or create junk authors.
	ed, _ := mustResolve(t, db, EditionInput{Title: "Bare Record"})
	if ed.ID == 0 {
		t.Fatal("no edition created for a bare record")
	}
	var authors int64
	db.Model(&models.CatalogAuthor{}).Count(&authors)
	if authors != 0 {
		t.Errorf("an empty author name created %d author rows", authors)
	}

	// An entirely empty input is degenerate but must still be handled.
	if _, _, err := Resolve(db, EditionInput{}); err != nil {
		t.Errorf("empty input returned an error: %v", err)
	}
}

func TestResolveIgnoresUnparseableISBN(t *testing.T) {
	db := fresh(t)
	// Truncated 12-digit ISBNs are all over the real data. They must not be
	// stored as if valid, and must not match each other.
	a, _ := mustResolve(t, db, EditionInput{
		Title: "Book One", ISBN: "978-0-7432-7356", Language: "en", PublicationYear: 2000,
	})
	b, _ := mustResolve(t, db, EditionInput{
		Title: "Book Two", ISBN: "978-0-06-112008", Language: "en", PublicationYear: 2000,
	})
	if a.ID == b.ID {
		t.Error("two different books with unparseable ISBNs were merged")
	}
	if a.ISBN13 != "" {
		t.Errorf("an unparseable ISBN was stored as ISBN13: %q", a.ISBN13)
	}
}

func TestReindexRepairsStaleKeys(t *testing.T) {
	db := fresh(t)
	ed, _ := mustResolve(t, db, EditionInput{
		Title: "Keyed Book", AuthorName: "Some Author", Language: "en", PublicationYear: 2000,
	})

	// Simulate rows written before the key columns existed.
	db.Model(&models.Edition{}).Where("id = ?", ed.ID).
		Updates(map[string]any{"title_key": "", "language_key": ""})
	db.Model(&models.Work{}).Where("id = ?", ed.WorkID).
		Updates(map[string]any{"title_key": "", "match_key": ""})

	n, err := Reindex(db)
	if err != nil {
		t.Fatalf("Reindex failed: %v", err)
	}
	if n < 2 {
		t.Errorf("Reindex reported %d repairs, want at least 2", n)
	}

	var got models.Edition
	db.First(&got, ed.ID)
	if got.TitleKey != NormalizeKey("Keyed Book") {
		t.Errorf("title_key not repaired: %q", got.TitleKey)
	}

	// And a second pass should find nothing left to do.
	again, err := Reindex(db)
	if err != nil {
		t.Fatalf("second Reindex failed: %v", err)
	}
	if again != 0 {
		t.Errorf("Reindex is not idempotent: second pass changed %d rows", again)
	}
}
