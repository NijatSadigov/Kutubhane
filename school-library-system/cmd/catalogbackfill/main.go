// Command catalogbackfill lifts branch-scoped Book rows into the global
// Work/Edition catalog and links each holding to its edition.
//
// It is idempotent — books already linked are skipped — so it is safe to re-run
// after new branches or books are added.
//
// Usage:
//
//	go run ./cmd/catalogbackfill            # dry run, writes nothing
//	go run ./cmd/catalogbackfill -apply     # actually write
//
// Point it at a scratch database first:
//
//	DATABASE_DSN="...dbname=school_library_migtest" go run ./cmd/catalogbackfill -apply
package main

import (
	"flag"
	"fmt"
	"os"

	"school-library-system/catalog"
	"school-library-system/database"
	"school-library-system/models"
)

func main() {
	apply := flag.Bool("apply", false, "write the changes; without this the run is a dry run")
	flag.Parse()

	database.Connect()

	// The new tables must exist before the backfill can fill them. Harmless if
	// the server has already migrated them.
	if err := database.DB.AutoMigrate(
		&models.CatalogAuthor{},
		&models.CatalogPublisher{},
		&models.Work{},
		&models.Edition{},
		&models.Book{},
	); err != nil {
		fmt.Fprintf(os.Stderr, "migrate: %v\n", err)
		os.Exit(1)
	}

	if *apply {
		fmt.Println("=== APPLYING ===")
	} else {
		fmt.Println("=== DRY RUN (nothing will be written; pass -apply to commit) ===")
	}

	rep, err := catalog.Backfill(database.DB, !*apply)
	if err != nil {
		fmt.Fprintf(os.Stderr, "backfill failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Print(rep.String())

	if !*apply {
		fmt.Println("\nnothing was written. re-run with -apply to commit.")
	}
}
