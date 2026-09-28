package handlers

import (
	"strconv"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// The circulation desk. Everything here is a view over loans and reservations
// the branch already has — the desk screens need it shaped for a counter, not
// for a report.

// DeskRow is one line in "today at the desk" or the overdue list.
type DeskRow struct {
	LoanID         uint       `json:"loan_id"`
	StudentID      uint       `json:"student_id"`
	StudentName    string     `json:"student_name"`
	StudentGrade   string     `json:"student_grade"`
	Title          string     `json:"title"`
	TrackingNumber string     `json:"tracking_number"`
	IssueDate      time.Time  `json:"issue_date"`
	DueDate        time.Time  `json:"due_date"`
	ReturnDate     *time.Time `json:"return_date"`
	// DaysOverdue is positive once a loan is late. The design colours it
	// amber 1–6, orange 7–13, coral 14+.
	DaysOverdue int    `json:"days_overdue"`
	Action      string `json:"action"` // "out" when issued today, "in" when returned today
}

// GetDeskSummary backs the Circulation desk: the KPI strip, what has happened
// at the counter today, and the overdue list.
func GetDeskSummary(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// --- today's activity ---
	var issuedToday []models.Loan
	branchLoans(branchID).Where("loans.issue_date >= ?", startOfDay).Find(&issuedToday)

	var returnedToday []models.Loan
	branchLoans(branchID).Where("loans.return_date >= ?", startOfDay).Find(&returnedToday)

	today := make([]DeskRow, 0, len(issuedToday)+len(returnedToday))
	for _, l := range issuedToday {
		today = append(today, deskRow(l, "out", now))
	}
	for _, l := range returnedToday {
		today = append(today, deskRow(l, "in", now))
	}

	// --- overdue ---
	var overdueLoans []models.Loan
	branchLoans(branchID).
		Where("loans.return_date IS NULL AND loans.due_date < ?", now).
		Order("loans.due_date asc").
		Find(&overdueLoans)

	overdue := make([]DeskRow, 0, len(overdueLoans))
	badlyLate := 0
	for _, l := range overdueLoans {
		row := deskRow(l, "", now)
		if row.DaysOverdue >= 14 {
			badlyLate++
		}
		overdue = append(overdue, row)
	}

	// --- KPIs ---
	var activeLoans, members, holdsPending int64
	database.DB.Model(&models.Loan{}).
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.branch_id = ? AND loans.return_date IS NULL", branchID).
		Count(&activeLoans)
	database.DB.Model(&models.Student{}).Where("branch_id = ?", branchID).Count(&members)
	database.DB.Model(&models.Reservation{}).
		Joins("JOIN reservation_statuses ON reservation_statuses.id = reservations.status_id").
		Joins("JOIN book_copies ON book_copies.id = reservations.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.branch_id = ? AND reservation_statuses.code IN ?", branchID, []string{"PENDING", "APPROVED"}).
		Count(&holdsPending)

	var requestsPending int64
	database.DB.Model(&models.BookRequest{}).
		Where("branch_id = ? AND status = ?", branchID, "PENDING").Count(&requestsPending)

	// The design puts a comparison under "checked out today" — "+6 vs last
	// Sat". The honest comparison is the same weekday a week ago, because a
	// school library's Saturday looks nothing like its Tuesday.
	prevStart := startOfDay.AddDate(0, 0, -7)
	var issuedPrev int64
	branchLoans(branchID).
		Where("loans.issue_date >= ? AND loans.issue_date < ?", prevStart, prevStart.AddDate(0, 0, 1)).
		Count(&issuedPrev)

	return c.JSON(fiber.Map{
		"issued_prev_weekday": issuedPrev,
		"weekday":             now.Weekday().String(),
		"issued_today":        len(issuedToday),
		"returned_today":      len(returnedToday),
		"active_loans":        activeLoans,
		"overdue":             len(overdue),
		"overdue_14_plus":     badlyLate,
		"holds_pending":       holdsPending,
		"requests_pending":    requestsPending,
		"tickets_unread":      unreadTicketsForLibrarian(c),
		"textbook_requests":   openTextbookRequestCount(branchID),
		"members":             members,
		"today":               today,
		"overdue_rows":        overdue,
	})
}

func deskRow(l models.Loan, action string, now time.Time) DeskRow {
	grade := ""
	if l.Student.Grade > 0 {
		grade = strconv.Itoa(l.Student.Grade)
		if l.Student.ClassGroup != "" {
			grade += "-" + l.Student.ClassGroup
		}
	}
	days := 0
	if l.ReturnDate == nil && now.After(l.DueDate) {
		days = int(now.Sub(l.DueDate).Hours() / 24)
	}
	return DeskRow{
		LoanID: l.ID, StudentID: l.StudentID, StudentName: l.Student.Name, StudentGrade: grade,
		Title: l.BookCopy.Book.Title, TrackingNumber: l.BookCopy.TrackingNumber,
		IssueDate: l.IssueDate, DueDate: l.DueDate, ReturnDate: l.ReturnDate,
		DaysOverdue: days, Action: action,
	}
}

// branchLoans is the base query every desk view needs: loans of this branch,
// with the student and book already loaded.
func branchLoans(branchID uint) *gorm.DB {
	return database.DB.Model(&models.Loan{}).
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.branch_id = ?", branchID).
		Preload("Student").
		Preload("BookCopy").
		Preload("BookCopy.Book")
}
