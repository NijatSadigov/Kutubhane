package handlers

import (
	"strconv"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// The moderation queue.
//
// Everything underneath this already worked: a reader can report a review,
// Review.Hidden and Review.Spoiler exist, and `hidden = false` is filtered at
// every one of the eight places a review reaches a reader. What was missing
// was the only part a person touches — a screen showing the reports. So
// ReportReview wrote rows that nothing ever read, Resolved and Resolution were
// never set, and Review.Hidden carried the comment "set by a moderator" while
// nothing in the codebase set it. A child reporting something sent it into a
// table no screen could reach.
//
// SCOPE: school-wide, for every role that can reach it. Moderation scope has
// to match visibility scope — a review is shown across the school (the
// Discover feed and the top-reviewer query both join on school_id), so a
// branch-scoped queue would let a teacher see a harmful review on their own
// feed and have no way to act on it. Guarded by IsTeacher, which admits a
// teacher, a librarian, the administration and a platform admin; a teacher
// moderating is what the design asks for and is why a teacher could not
// moderate at all before (DeleteReview admits staff only).
//
// A resolved report is kept, with who resolved it and how. "What happened to
// that report" is a question a parent can ask.

// Resolutions a moderator can choose. The model's own comment names these.
const (
	ResKeep       = "KEEP"
	ResSpoilerTag = "SPOILER_TAG"
	ResHide       = "HIDE"
	ResHideWarn   = "HIDE_WARN"
)

type reportRow struct {
	ID         uint      `json:"id"`
	ReviewID   uint      `json:"review_id"`
	Reason     string    `json:"reason"`
	Note       string    `json:"note"`
	CreatedAt  time.Time `json:"created_at"`
	Resolved   bool      `json:"resolved"`
	Resolution string    `json:"resolution"`

	ReporterName string  `json:"reporter_name"`
	AuthorName   string  `json:"author_name"`
	AuthorClass  string  `json:"author_class"`
	WorkTitle    string  `json:"work_title"`
	ReviewText   string  `json:"review_text"`
	ReviewHidden bool    `json:"review_hidden"`
	ReviewSpoil  bool    `json:"review_spoiler"`
	Rating       float64 `json:"rating"`
}

// GetModerationReports lists reports on reviews written by readers of the
// caller's school. Open ones first; ?state=all includes what has been handled.
func GetModerationReports(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}

	all := c.Query("state") == "all"
	where := "b.school_id = ?"
	args := []any{schoolID}
	if !all {
		where += " AND rep.resolved = false"
	}

	var rows []reportRow
	// The reporter is joined separately from the author: both are readers, and
	// a queue that does not say who complained is hard to judge.
	database.DB.Raw(`
		SELECT rep.id, rep.review_id, rep.reason, rep.note, rep.created_at,
		       rep.resolved, rep.resolution,
		       COALESCE(reporter.name, '')       AS reporter_name,
		       COALESCE(author.name, '')         AS author_name,
		       CASE WHEN author.grade > 0
		            THEN author.grade::text ||
		                 CASE WHEN COALESCE(author.class_group, '') <> ''
		                      THEN '-' || author.class_group ELSE '' END
		            ELSE '' END               AS author_class,
		       COALESCE(w.title, '')             AS work_title,
		       COALESCE(r.text, '')              AS review_text,
		       r.hidden                          AS review_hidden,
		       r.spoiler                         AS review_spoil,
		       COALESCE(r.rating, 0)             AS rating
		FROM review_reports rep
		JOIN reviews  r        ON r.id = rep.review_id
		JOIN students author   ON author.user_id = r.user_id
		JOIN branches b        ON b.id = author.branch_id
		LEFT JOIN students reporter ON reporter.user_id = rep.user_id
		LEFT JOIN works w      ON w.id = r.work_id
		WHERE `+where+`
		ORDER BY rep.resolved ASC, rep.created_at DESC
		LIMIT 200`, args...).Scan(&rows)

	if rows == nil {
		rows = []reportRow{}
	}

	var open int64
	database.DB.Raw(`
		SELECT count(*) FROM review_reports rep
		JOIN reviews r      ON r.id = rep.review_id
		JOIN students s     ON s.user_id = r.user_id
		JOIN branches b     ON b.id = s.branch_id
		WHERE b.school_id = ? AND rep.resolved = false`, schoolID).Scan(&open)

	return c.JSON(fiber.Map{"reports": rows, "open": open})
}

// ResolveModerationReport records what a moderator decided and applies it to
// the review.
//
// KEEP leaves the review alone; the report is closed so the queue does not ask
// again. SPOILER_TAG hides the text behind a spoiler warning rather than
// removing it, which is the right answer to most of what gets reported.
// HIDE and HIDE_WARN both take it off every reader-facing surface; the
// difference is whether the school follows it up with the child, which happens
// outside the software.
//
// The review row is never deleted: a hidden review stays so that a teacher or
// a parent can still see what was written.
func ResolveModerationReport(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	id, _ := strconv.Atoi(c.Params("id"))

	type Req struct {
		Resolution string `json:"resolution"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	switch req.Resolution {
	case ResKeep, ResSpoilerTag, ResHide, ResHideWarn:
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Unknown resolution"})
	}

	var rep models.ReviewReport
	if err := database.DB.First(&rep, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Report not found"})
	}

	// The report must belong to this school, checked through the review's
	// author rather than taken from the request.
	var inSchool int64
	database.DB.Raw(`
		SELECT count(*) FROM reviews r
		JOIN students s ON s.user_id = r.user_id
		JOIN branches b ON b.id = s.branch_id
		WHERE r.id = ? AND b.school_id = ?`, rep.ReviewID, schoolID).Scan(&inSchool)
	if inSchool == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "That report is not your school's"})
	}

	tx := database.DB.Begin()

	switch req.Resolution {
	case ResSpoilerTag:
		if err := tx.Model(&models.Review{}).Where("id = ?", rep.ReviewID).
			Update("spoiler", true).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Could not tag the review"})
		}
	case ResHide, ResHideWarn:
		if err := tx.Model(&models.Review{}).Where("id = ?", rep.ReviewID).
			Update("hidden", true).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Could not hide the review"})
		}
	}

	now := time.Now()
	// Every open report on the same review closes together: two children
	// reporting one review is one decision, not two.
	if err := tx.Model(&models.ReviewReport{}).
		Where("review_id = ? AND resolved = false", rep.ReviewID).
		Updates(map[string]any{
			"resolved": true, "resolution": req.Resolution,
			"resolved_by": uid, "resolved_at": now,
		}).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Could not record the decision"})
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not record the decision"})
	}
	return c.JSON(fiber.Map{"id": rep.ID, "review_id": rep.ReviewID, "resolution": req.Resolution})
}

// UnhideReview puts a hidden review back. A moderator can be wrong, and
// without this a mistake was permanent.
func UnhideReview(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var inSchool int64
	database.DB.Raw(`
		SELECT count(*) FROM reviews r
		JOIN students s ON s.user_id = r.user_id
		JOIN branches b ON b.id = s.branch_id
		WHERE r.id = ? AND b.school_id = ?`, id, schoolID).Scan(&inSchool)
	if inSchool == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "That review is not your school's"})
	}

	if err := database.DB.Model(&models.Review{}).Where("id = ?", id).
		Updates(map[string]any{"hidden": false, "spoiler": false}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not restore the review"})
	}
	return c.JSON(fiber.Map{"id": id, "hidden": false})
}
