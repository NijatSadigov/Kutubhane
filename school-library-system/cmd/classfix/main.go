// Command classfix reconciles the two places a reader's class is written down.
//
// handlers/studentclass.go explains the rule and now keeps new writes in step.
// This is for the readers who were written before it: anyone whose grade and
// letter match a Classroom their branch runs, but who is not on its roster.
// They are in the class for every reading feature and on nobody's textbook
// list, which goes unnoticed until the books are handed out and one child has
// none.
//
// It does not touch readers whose class has no Classroom at all — most classes
// in a school do not, because the dərslik system is set up per class — nor
// anyone already on a roster.
//
// Usage:
//
//	go run ./cmd/classfix            # report only, writes nothing
//	go run ./cmd/classfix -apply     # attach them
//
// Point it at a scratch database first:
//
//	DATABASE_DSN="...dbname=school_library_test" go run ./cmd/classfix -apply
package main

import (
	"flag"
	"fmt"
	"os"

	"school-library-system/database"
	"school-library-system/models"
)

type row struct {
	UserID      uint
	Name        string
	Grade       int
	ClassGroup  string
	BranchName  string
	ClassroomID uint
	RoomLabel   string
}

func main() {
	apply := flag.Bool("apply", false, "write the changes; without this the run is a report")
	flag.Parse()

	database.Connect()

	var rows []row
	err := database.DB.Raw(`
		SELECT s.user_id, s.name, s.grade, s.class_group,
		       b.name AS branch_name,
		       c.id   AS classroom_id,
		       c.grade || '-' || c.letter AS room_label
		  FROM students s
		  JOIN branches b   ON b.id = s.branch_id
		  JOIN classrooms c ON c.branch_id = s.branch_id
		                   AND c.grade = s.grade
		                   AND upper(trim(c.letter)) = upper(trim(s.class_group))
		 WHERE s.classroom_id IS NULL
		   AND s.grade > 0
		   AND trim(s.class_group) <> ''
		 ORDER BY s.grade, s.class_group, s.name`).Scan(&rows).Error
	if err != nil {
		fmt.Fprintln(os.Stderr, "could not read:", err)
		os.Exit(1)
	}

	if len(rows) == 0 {
		fmt.Println("Nothing to do: every reader whose class the school runs a classroom for is on its roster.")
		reportUnrostered()
		return
	}

	fmt.Printf("%d reader(s) in a class their branch runs a classroom for, but not on its roster:\n\n", len(rows))
	for _, r := range rows {
		fmt.Printf("  %-22s %-10s %s → classroom %d (%s)\n",
			r.Name, fmt.Sprintf("%d-%s", r.Grade, r.ClassGroup), r.BranchName, r.ClassroomID, r.RoomLabel)
	}
	fmt.Println()

	if !*apply {
		fmt.Println("Report only. Re-run with -apply to attach them.")
		reportUnrostered()
		return
	}

	n := 0
	for _, r := range rows {
		res := database.DB.Model(&models.Student{}).
			Where("user_id = ? AND classroom_id IS NULL", r.UserID).
			Update("classroom_id", r.ClassroomID)
		n += int(res.RowsAffected)
	}
	fmt.Printf("Attached %d reader(s).\n", n)
	reportUnrostered()
}

// reportUnrostered counts the readers this command deliberately leaves alone,
// so the number is not mistaken for work still to do.
func reportUnrostered() {
	var n int64
	database.DB.Raw(`
		SELECT count(*) FROM students s
		 WHERE s.classroom_id IS NULL AND s.grade > 0 AND trim(s.class_group) <> ''`).Scan(&n)
	if n > 0 {
		fmt.Printf("\n%d reader(s) are in a class the dərslik system has no classroom for.\n", n)
		fmt.Println("That is not a fault: a school sets the textbook system up class by class.")
		fmt.Println("Create the classroom and run this again to put them on it.")
	}
}
