package handlers

import (
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Promoting the school a year — 7-A becomes 8-A, and the top year leaves.
//
// The decision that shapes this: it **creates next year's classrooms rather
// than renaming this year's.** Renaming would be one UPDATE per row and would
// quietly rewrite history — the textbook ledger is keyed on ClassroomID, so
// last year's movements for 7-A would start reading as 8-A's, and what a class
// held in a year it no longer exists in would be unanswerable. Holdings are
// derived from that ledger precisely so a number cannot drift from its own
// history; renaming a classroom out from under it would drift everything at
// once.
//
// So each classroom in the old year gets a counterpart in the new one, the
// children move across, and the old rows stay exactly as they were. A year's
// classrooms are that year's record.
//
// Who is moved: only ACTIVE students in a classroom. ALUMNI stay ALUMNI — they
// have already left and promoting them again is meaningless — and LEFT stays
// LEFT. A child with no classroom is not swept into one.
//
// The final grade graduates instead of being promoted: its students become
// ALUMNI and no counterpart classroom is made.

// The last grade of an Azerbaijani school. Overridable per call, because a
// primary-only branch finishes earlier and this is a guess rather than a fact
// about every school.
const defaultFinalGrade = 11

// RolloverClassPlan is one classroom's fate, named the way a person would say
// it: "7-A → 8-A, 10 children" or "11-A graduates, 9 children".
type RolloverClassPlan struct {
	ClassroomID  uint   `json:"classroom_id"`
	From         string `json:"from"`
	To           string `json:"to"`
	Graduates    bool   `json:"graduates"`
	StudentCount int    `json:"student_count"`
	// Textbooks the class has not given back. Not a blocker — a school may
	// roll over in August with two copies still missing — but it is the thing
	// most worth seeing before pressing the button, because the debt follows
	// the old classroom and not the children.
	Outstanding int `json:"outstanding"`
}

type RolloverPlan struct {
	FromYear   string              `json:"from_year"`
	ToYear     string              `json:"to_year"`
	FinalGrade int                 `json:"final_grade"`
	Classes    []RolloverClassPlan `json:"classes"`
	Promoted   int                 `json:"promoted"`
	Graduating int                 `json:"graduating"`
	// Set when the target year already has classrooms, which almost always
	// means this has been run once already.
	AlreadyHasClasses bool `json:"already_has_classes"`
}

// buildRolloverPlan works out what would happen, and is the single source both
// the preview and the write use — so the screen cannot promise one thing and
// the button do another.
func buildRolloverPlan(schoolID, fromYearID, toYearID uint, finalGrade int) (*RolloverPlan, error) {
	var from, to models.AcademicYear
	if err := database.DB.Where("id = ? AND school_id = ?", fromYearID, schoolID).
		First(&from).Error; err != nil {
		return nil, fiber.NewError(404, "The year being promoted was not found")
	}
	if err := database.DB.Where("id = ? AND school_id = ?", toYearID, schoolID).
		First(&to).Error; err != nil {
		return nil, fiber.NewError(404, "The year being promoted into was not found")
	}
	if from.ID == to.ID {
		return nil, fiber.NewError(400, "Pick a different year to promote into")
	}

	var rooms []models.Classroom
	database.DB.Where("school_id = ? AND academic_year_id = ?", schoolID, from.ID).
		Order("grade, letter").Find(&rooms)

	var existing int64
	database.DB.Model(&models.Classroom{}).
		Where("school_id = ? AND academic_year_id = ?", schoolID, to.ID).Count(&existing)

	plan := &RolloverPlan{
		FromYear: from.Label, ToYear: to.Label, FinalGrade: finalGrade,
		AlreadyHasClasses: existing > 0,
		Classes:           make([]RolloverClassPlan, 0, len(rooms)),
	}

	for _, r := range rooms {
		var n int64
		database.DB.Model(&models.Student{}).
			Where("classroom_id = ? AND status = ?", r.ID, models.StudentActive).Count(&n)

		row := RolloverClassPlan{
			ClassroomID: r.ID, From: r.Label(), StudentCount: int(n),
			Outstanding: outstandingForClass(r.ID),
		}
		if r.Grade >= finalGrade {
			row.Graduates = true
			plan.Graduating += int(n)
		} else {
			next := models.Classroom{Grade: r.Grade + 1, Letter: r.Letter}
			row.To = next.Label()
			plan.Promoted += int(n)
		}
		plan.Classes = append(plan.Classes, row)
	}

	return plan, nil
}

// outstandingForClass is every title the class has not squared away, summed.
func outstandingForClass(classroomID uint) int {
	var ids []uint
	database.DB.Model(&models.TextbookMovement{}).
		Where("classroom_id = ?", classroomID).
		Distinct().Pluck("textbook_id", &ids)
	n := 0
	for _, id := range ids {
		n += outstandingFor(classroomID, id)
	}
	return n
}

// PreviewRollover answers "what would happen", and changes nothing. The screen
// shows this and makes the administration read it before the write is offered,
// because the write cannot be undone from the UI.
func PreviewRollover(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	finalGrade := c.QueryInt("final_grade")
	if finalGrade < 1 {
		finalGrade = defaultFinalGrade
	}
	plan, err := buildRolloverPlan(schoolID,
		uint(c.QueryInt("from_year_id")), uint(c.QueryInt("to_year_id")), finalGrade)
	if err != nil {
		return err
	}
	return c.JSON(plan)
}

// ApplyRollover promotes the school. One transaction: a half-promoted school,
// where 7-A moved up and 8-A did not, is not a state anybody could unpick by
// hand.
func ApplyRollover(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var req struct {
		FromYearID uint `json:"from_year_id"`
		ToYearID   uint `json:"to_year_id"`
		FinalGrade int  `json:"final_grade"`
		// The administration confirming they have read the preview. Required,
		// because this is the one action in the system that cannot be undone
		// from a screen.
		Confirm bool `json:"confirm"`
		// Promoting into a year that already has classes would create a second
		// 8-A beside the first. Refused unless the caller says they mean it.
		Force bool `json:"force"`
		// Whether the new year becomes the current one. Usually yes — that is
		// what promoting means — but a school may prepare next year in advance.
		MakeCurrent bool `json:"make_current"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if !req.Confirm {
		return c.Status(400).JSON(fiber.Map{
			"error": "Read the preview and confirm first", "code": "CONFIRM_REQUIRED"})
	}
	if req.FinalGrade < 1 {
		req.FinalGrade = defaultFinalGrade
	}

	plan, err := buildRolloverPlan(schoolID, req.FromYearID, req.ToYearID, req.FinalGrade)
	if err != nil {
		return err
	}
	if plan.AlreadyHasClasses && !req.Force {
		return c.Status(400).JSON(fiber.Map{
			"error": "That year already has classes — promoting again would duplicate them",
			"code":  "ALREADY_ROLLED_OVER"})
	}
	if len(plan.Classes) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "There are no classes to promote"})
	}

	promoted, graduated, created := 0, 0, 0

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		for _, row := range plan.Classes {
			var old models.Classroom
			if err := tx.Preload("Teachers").First(&old, row.ClassroomID).Error; err != nil {
				return err
			}

			if row.Graduates {
				// The top year leaves. Their classroom stays where it is, with
				// its ledger; the children keep their account and their whole
				// reading history and simply stop being in a class.
				res := tx.Model(&models.Student{}).
					Where("classroom_id = ? AND status = ?", old.ID, models.StudentActive).
					Updates(map[string]any{
						"status":       models.StudentAlumni,
						"classroom_id": nil,
					})
				graduated += int(res.RowsAffected)
				continue
			}

			next := models.Classroom{
				BranchID: old.BranchID, SchoolID: old.SchoolID,
				Grade: old.Grade + 1, Letter: old.Letter,
				AcademicYearID: &req.ToYearID,
			}
			if err := tx.Create(&next).Error; err != nil {
				return err
			}
			created++

			// The teachers come across as a starting point rather than a
			// claim: a school that reassigns them edits one screen, which is
			// less work than assigning every class from nothing.
			if len(old.Teachers) > 0 {
				if err := tx.Model(&next).Association("Teachers").Append(old.Teachers); err != nil {
					return err
				}
			}

			// Grade and ClassGroup are the free-text pair the reader screens
			// still print, so they move in step with the classroom. Letting
			// them go stale is how "7-A" ends up on an eighth-grader's profile.
			res := tx.Model(&models.Student{}).
				Where("classroom_id = ? AND status = ?", old.ID, models.StudentActive).
				Updates(map[string]any{
					"classroom_id": next.ID,
					"grade":        next.Grade,
					"class_group":  next.Letter,
				})
			promoted += int(res.RowsAffected)
		}
		return nil
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not promote the school"})
	}

	if req.MakeCurrent {
		setCurrentYear(schoolID, req.ToYearID)
	}

	return c.JSON(fiber.Map{
		"promoted": promoted, "graduated": graduated,
		"classes_created": created, "to_year": plan.ToYear,
	})
}
