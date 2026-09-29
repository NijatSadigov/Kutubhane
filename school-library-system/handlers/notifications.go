package handlers

import (
	"encoding/json"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// How many a bell shows. Older ones stay in the table for the record but are
// not worth a scroll — nobody acts on last term's reminder.
const notificationPageSize = 30

/* ------------------------------------------------------------- producing */

// notify records one notification. Params is marshalled here so callers pass a
// map rather than building JSON by hand.
//
// It never returns an error and never blocks the caller's own work: a textbook
// request going READY must still go READY if writing the notification fails.
// The whole point of this table is that it is a side effect of something that
// already succeeded.
func notify(userID uint, kind, subject string, subjectID uint, params map[string]any) {
	if userID == 0 {
		return
	}
	encoded := "{}"
	if params != nil {
		if b, err := json.Marshal(params); err == nil {
			encoded = string(b)
		}
	}
	database.DB.Create(&models.Notification{
		UserID:    userID,
		Kind:      kind,
		Subject:   subject,
		SubjectID: subjectID,
		Params:    encoded,
	})
}

// notifyMany fans one notification out to several recipients — used when the
// audience is a role rather than a person, as "the school administration" is.
func notifyMany(userIDs []uint, kind, subject string, subjectID uint, params map[string]any) {
	for _, id := range userIDs {
		notify(id, kind, subject, subjectID, params)
	}
}

// schoolAdministrators is who "the administration" means when a branch replies
// on a ticket: every manager of that school. A platform admin has no school and
// is deliberately left out, which is how the ticket queue already scopes them —
// they see every school's queue, but no one school's replies are theirs to
// answer.
func schoolAdministrators(schoolID uint) []uint {
	var ids []uint
	database.DB.Model(&models.Manager{}).
		Where("school_id = ?", schoolID).
		Pluck("user_id", &ids)
	return ids
}

/* --------------------------------------------------------------- reading */

// NotificationView is one row of the bell. The sentence is not here — Kind and
// Params are what the frontend renders from.
type NotificationView struct {
	ID        uint           `json:"id"`
	Kind      string         `json:"kind"`
	Subject   string         `json:"subject"`
	SubjectID uint           `json:"subject_id"`
	Params    map[string]any `json:"params"`
	Read      bool           `json:"read"`
	CreatedAt time.Time      `json:"created_at"`
}

// GetNotifications returns the caller's own notifications, newest first, with
// the unread count the bell's dot is drawn from.
//
// This sits on the plain authenticated group rather than behind a role guard,
// which is what lets one endpoint serve a student, a teacher, a librarian and a
// manager. The scope is the caller's own user id and cannot be widened by a
// query parameter.
func GetNotifications(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}

	var rows []models.Notification
	database.DB.Where("user_id = ?", uid).
		Order("created_at desc").
		Limit(notificationPageSize).
		Find(&rows)

	var unread int64
	database.DB.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL", uid).
		Count(&unread)

	items := make([]NotificationView, 0, len(rows))
	for _, n := range rows {
		params := map[string]any{}
		if n.Params != "" {
			// A row whose params will not parse is still worth showing — the
			// kind alone renders a usable sentence.
			_ = json.Unmarshal([]byte(n.Params), &params)
		}
		items = append(items, NotificationView{
			ID: n.ID, Kind: n.Kind, Subject: n.Subject, SubjectID: n.SubjectID,
			Params: params, Read: n.ReadAt != nil, CreatedAt: n.CreatedAt,
		})
	}

	return c.JSON(fiber.Map{"items": items, "unread": unread})
}

// MarkNotificationsSeen marks the caller's notifications read — all of them, or
// just the ids given. Scoped to the caller either way, so passing somebody
// else's id marks nothing rather than erroring: there is nothing to leak.
func MarkNotificationsSeen(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}

	var req struct {
		IDs []uint `json:"ids"`
	}
	// An empty body means "all", so a parse failure is not an error here.
	_ = c.BodyParser(&req)

	now := time.Now()
	q := database.DB.Model(&models.Notification{}).
		Where("user_id = ? AND read_at IS NULL", uid)
	if len(req.IDs) > 0 {
		q = q.Where("id IN ?", req.IDs)
	}
	res := q.Update("read_at", now)

	return c.JSON(fiber.Map{"marked": res.RowsAffected})
}

/* ------------------------------------------------- the overdue reminder */

// RemindOverdue is the desk's "send a reminder" button made real. It is
// deliberately a human action rather than a nightly sweep: a librarian decides
// who gets nudged, which is also why sending twice is allowed — a second nudge
// is a choice, not a bug.
//
// Two guards matter. A loan must be in the caller's own branch, and it must
// actually be overdue: the button drives off a list that may be minutes stale,
// and a reader who returned their book this morning should not be told off.
func RemindOverdue(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return err
	}

	var req struct {
		LoanIDs []uint `json:"loan_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if len(req.LoanIDs) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "No loans selected"})
	}

	var loans []models.Loan
	branchLoans(branchID).
		Where("loans.id IN ?", req.LoanIDs).
		Find(&loans)

	now := time.Now()
	sent := 0
	for _, l := range loans {
		if l.ReturnDate != nil || !now.After(l.DueDate) {
			continue // returned, or not actually late
		}
		notify(l.StudentID, models.NotifyLoanOverdue, models.NotifySubjectLoan, l.ID, map[string]any{
			"title": l.BookCopy.Book.Title,
			"days":  int(now.Sub(l.DueDate).Hours() / 24),
		})
		sent++
	}

	return c.JSON(fiber.Map{"sent": sent, "skipped": len(req.LoanIDs) - sent})
}
