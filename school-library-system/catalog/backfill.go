package catalog

import (
	"fmt"
	"sort"
	"strings"

	"school-library-system/models"

	"gorm.io/gorm"
)

// Report summarises what a backfill run did (or, in dry-run mode, would do).
type Report struct {
	BooksScanned     int
	BooksLinked      int
	BooksAlreadyDone int
	WorksCreated     int
	EditionsCreated  int
	AuthorsTotal     int
	PublishersTotal  int
	// EditionsReused counts holdings that matched an Edition another branch had
	// already contributed — the whole point of the exercise.
	EditionsReused int
	// Weaker matches, worth a curator's eye.
	EditionsMatchedRelaxed   int
	WorksMatchedOnTitleAlone int
	KeysReindexed            int
	Notes                    []string
}

func (r Report) String() string {
	var b strings.Builder
	fmt.Fprintf(&b, "books scanned:        %d\n", r.BooksScanned)
	fmt.Fprintf(&b, "  already linked:     %d\n", r.BooksAlreadyDone)
	fmt.Fprintf(&b, "  newly linked:       %d\n", r.BooksLinked)
	fmt.Fprintf(&b, "works created:        %d\n", r.WorksCreated)
	fmt.Fprintf(&b, "editions created:     %d\n", r.EditionsCreated)
	fmt.Fprintf(&b, "editions reused:      %d  (holdings that collapsed onto a shared edition)\n", r.EditionsReused)
	fmt.Fprintf(&b, "  of those, relaxed:  %d  (matched despite a missing publisher)\n", r.EditionsMatchedRelaxed)
	fmt.Fprintf(&b, "works matched on title alone: %d  (no author recorded)\n", r.WorksMatchedOnTitleAlone)
	fmt.Fprintf(&b, "catalog authors:      %d total\n", r.AuthorsTotal)
	fmt.Fprintf(&b, "catalog publishers:   %d total\n", r.PublishersTotal)
	if r.KeysReindexed > 0 {
		fmt.Fprintf(&b, "match keys reindexed: %d\n", r.KeysReindexed)
	}
	if len(r.Notes) > 0 {
		fmt.Fprintf(&b, "\nnotes (%d):\n", len(r.Notes))
		for _, n := range r.Notes {
			fmt.Fprintf(&b, "  - %s\n", n)
		}
	}
	return b.String()
}

// Backfill lifts every branch-scoped Book that is not yet linked to the global
// catalog into a Work + Edition, then points the Book at that Edition.
//
// It is idempotent: a Book that already has an EditionID is left alone, so the
// command can be run repeatedly and after new branches are added. With dryRun
// set nothing is written and the report describes what would have happened.
//
// Matching is delegated to Resolve — the same code path the book form uses — so
// the catalog cannot drift depending on how a book got in.
func Backfill(db *gorm.DB, dryRun bool) (Report, error) {
	rep := Report{}

	run := func(tx *gorm.DB) error {
		// Keys must be correct before anything is matched against them.
		n, err := Reindex(tx)
		if err != nil {
			return fmt.Errorf("reindex: %w", err)
		}
		rep.KeysReindexed = n

		var books []models.Book
		if err := tx.Order("id asc").Find(&books).Error; err != nil {
			return err
		}
		rep.BooksScanned = len(books)

		// The old model kept authors and publishers as branch-scoped lookup
		// tables; resolve their names once.
		branchAuthorNames := map[uint]string{}
		var bAuthors []models.Author
		if err := tx.Find(&bAuthors).Error; err != nil {
			return err
		}
		for _, a := range bAuthors {
			branchAuthorNames[a.ID] = a.Name
		}
		branchPubNames := map[uint]string{}
		var bPubs []models.Publisher
		if err := tx.Find(&bPubs).Error; err != nil {
			return err
		}
		for _, p := range bPubs {
			branchPubNames[p.ID] = p.Name
		}

		for i := range books {
			book := &books[i]
			if book.EditionID != nil && *book.EditionID != 0 {
				rep.BooksAlreadyDone++
				continue
			}

			in := EditionInput{
				Title:           book.Title,
				ISBN:            book.ISBN,
				Language:        book.Language,
				EditionLabel:    book.Edition,
				CoverURL:        book.CoverURL,
				CEFRLevel:       book.CEFRLevel,
				PublicationYear: book.PublicationYear,
				PageCount:       book.PageCount,
			}
			if book.AuthorID != nil {
				in.AuthorName = branchAuthorNames[*book.AuthorID]
			}
			if book.PublisherID != nil {
				in.PublisherName = branchPubNames[*book.PublisherID]
			}

			edition, info, err := Resolve(tx, in)
			if err != nil {
				return fmt.Errorf("resolve book %d: %w", book.ID, err)
			}

			if info.EditionCreated {
				rep.EditionsCreated++
			} else {
				rep.EditionsReused++
			}
			if info.WorkCreated {
				rep.WorksCreated++
			}
			if info.MatchedBy == MatchedByRelaxed {
				rep.EditionsMatchedRelaxed++
				rep.Notes = append(rep.Notes, fmt.Sprintf(
					"book %d (%q) merged onto edition %d despite a missing publisher",
					book.ID, book.Title, edition.ID))
			}
			if info.WorkMatchedOnTitleAlone {
				rep.WorksMatchedOnTitleAlone++
				rep.Notes = append(rep.Notes, fmt.Sprintf(
					"book %d (%q) attached to work %d on title alone — no author recorded",
					book.ID, book.Title, edition.WorkID))
			}
			if info.Ambiguity != "" {
				rep.Notes = append(rep.Notes, fmt.Sprintf("book %d: %s", book.ID, info.Ambiguity))
			}
			if book.Title == "" {
				rep.Notes = append(rep.Notes, fmt.Sprintf(
					"book %d has an empty title — created a placeholder work", book.ID))
			}
			if ISBN13(book.ISBN) == "" && book.ISBN != "" {
				rep.Notes = append(rep.Notes, fmt.Sprintf(
					"book %d has an unparseable ISBN %q — matched on title instead", book.ID, book.ISBN))
			}

			if err := tx.Model(&models.Book{}).Where("id = ?", book.ID).
				Update("edition_id", edition.ID).Error; err != nil {
				return fmt.Errorf("link book %d: %w", book.ID, err)
			}
			rep.BooksLinked++
		}

		var authors, pubs int64
		if err := tx.Model(&models.CatalogAuthor{}).Count(&authors).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.CatalogPublisher{}).Count(&pubs).Error; err != nil {
			return err
		}
		rep.AuthorsTotal, rep.PublishersTotal = int(authors), int(pubs)

		sort.Strings(rep.Notes)
		if dryRun {
			// Unwind everything this run touched.
			return errDryRun
		}
		return nil
	}

	err := db.Transaction(run)
	if err == errDryRun {
		err = nil
	}
	return rep, err
}

// errDryRun is a sentinel used to roll back the dry-run transaction.
var errDryRun = fmt.Errorf("dry run: rolled back")
