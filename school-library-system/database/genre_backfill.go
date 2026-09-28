package database

import (
	"log"

	"school-library-system/catalog"
	"school-library-system/models"
)

// BackfillWorkGenres moves genre and topic off the branch-scoped lists and onto
// the Work, where they belong: a book's genre is a fact about the book, not
// about which branch shelved it.
//
// Every holding that carries a branch genre or topic has its name resolved to a
// global CatalogGenre/CatalogTopic by normalized key, which also collapses the
// near-duplicates the old per-branch lists accumulated ("Distopya" in one
// branch, "Distopiya" in another). The value is written to the holding's Work.
//
// Two branches can disagree about one Work's genre. The first non-empty value
// wins and the disagreement is logged rather than silently overwritten, because
// which of the two is right is a librarian's call, not this function's.
//
// Idempotent: a Work that already carries a genre is left alone, so it is safe
// on every boot and does not fight a librarian who has since corrected one.
func BackfillWorkGenres() {
	type row struct {
		WorkID    uint
		GenreName string
		TopicName string
		BranchID  uint
	}

	// A branch list may hold names nobody has used on a book yet. Those are a
	// librarian's curated vocabulary, so carry them over too — otherwise they
	// simply disappear from the settings screen when it starts reading the
	// global list.
	carryList("genres", func(name string) { catalog.FindOrCreateGenre(DB, name) })
	carryList("topics", func(name string) { catalog.FindOrCreateTopic(DB, name) })

	var rows []row
	err := DB.Table("books").
		Select(`editions.work_id AS work_id,
		        COALESCE(genres.name, '') AS genre_name,
		        COALESCE(topics.name, '') AS topic_name,
		        books.branch_id AS branch_id`).
		Joins("JOIN editions ON editions.id = books.edition_id").
		Joins("LEFT JOIN genres ON genres.id = books.genre_id").
		Joins("LEFT JOIN topics ON topics.id = books.topic_id").
		Where("books.edition_id IS NOT NULL AND (books.genre_id IS NOT NULL OR books.topic_id IS NOT NULL)").
		Scan(&rows).Error
	if err != nil {
		log.Printf("[catalog] genre backfill: could not read holdings (%v)", err)
		return
	}
	if len(rows) == 0 {
		return
	}

	movedGenre, movedTopic, conflicts := 0, 0, 0

	for _, r := range rows {
		var w models.Work
		if err := DB.First(&w, r.WorkID).Error; err != nil {
			continue
		}

		if r.GenreName != "" {
			if w.GenreID == nil {
				id, err := catalog.FindOrCreateGenre(DB, r.GenreName)
				if err == nil && id != nil {
					DB.Model(&models.Work{}).Where("id = ?", w.ID).Update("genre_id", *id)
					w.GenreID = id
					movedGenre++
				}
			} else if !sameGlobalName(w.GenreID, r.GenreName, "catalog_genres") {
				conflicts++
				log.Printf("[catalog] work %d: branch %d calls it %q, keeping the existing genre",
					w.ID, r.BranchID, r.GenreName)
			}
		}

		if r.TopicName != "" && w.TopicID == nil {
			id, err := catalog.FindOrCreateTopic(DB, r.TopicName)
			if err == nil && id != nil {
				DB.Model(&models.Work{}).Where("id = ?", w.ID).Update("topic_id", *id)
				movedTopic++
			}
		}
	}

	if movedGenre > 0 || movedTopic > 0 || conflicts > 0 {
		log.Printf("[catalog] genre backfill: %d genres and %d topics moved onto works, %d branch disagreements left as they were",
			movedGenre, movedTopic, conflicts)
	}
}

// carryList copies every name from an old branch-scoped list into the global
// one. find-or-create by normalized key, so the branches collapse together.
func carryList(table string, add func(string)) {
	var names []string
	if err := DB.Table(table).Distinct().Pluck("name", &names).Error; err != nil {
		return
	}
	for _, n := range names {
		if n != "" {
			add(n)
		}
	}
}

// sameGlobalName reports whether the global row already carries this name, by
// normalized key — so "Distopya" and "Distopiya" do not count as a conflict.
func sameGlobalName(id *uint, name, table string) bool {
	if id == nil {
		return false
	}
	var existing string
	if err := DB.Table(table).Select("name_key").Where("id = ?", *id).Scan(&existing).Error; err != nil {
		return false
	}
	return existing == catalog.NormalizeKey(name)
}
