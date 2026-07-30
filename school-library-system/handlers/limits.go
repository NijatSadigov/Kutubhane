package handlers

import (
	"school-library-system/database"
	"school-library-system/models"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

// activeHoldCodes are the reservation states that tie up a book toward a
// student's borrow limit (a completed/rejected one no longer counts).
var activeHoldCodes = []string{"PENDING", "APPROVED"}

// studentHoldCount = active loans (not yet returned) + pending/approved reservations.
func studentHoldCount(studentID uint) int64 {
	var loans int64
	database.DB.Model(&models.Loan{}).
		Where("student_id = ? AND return_date IS NULL", studentID).
		Count(&loans)

	var res int64
	database.DB.Model(&models.Reservation{}).
		Joins("JOIN reservation_statuses ON reservation_statuses.id = reservations.status_id").
		Where("reservations.student_id = ? AND reservation_statuses.code IN ?", studentID, activeHoldCodes).
		Count(&res)

	return loans + res
}

// studentEffectiveLimit = the student's own override if set, else the branch default,
// else 5 as a last-resort fallback.
func studentEffectiveLimit(studentID uint) int {
	var stu models.Student
	if err := database.DB.First(&stu, "user_id = ?", studentID).Error; err != nil {
		return 5
	}
	if stu.LoanLimit != nil {
		return *stu.LoanLimit
	}
	var br models.Branch
	if err := database.DB.First(&br, stu.BranchID).Error; err == nil && br.LoanLimit > 0 {
		return br.LoanLimit
	}
	return 5
}

// studentHasActiveLoanForBook reports whether the student currently holds any copy
// of this book on an unreturned loan.
func studentHasActiveLoanForBook(studentID, bookID uint) bool {
	var n int64
	database.DB.Model(&models.Loan{}).
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Where("loans.student_id = ? AND book_copies.book_id = ? AND loans.return_date IS NULL", studentID, bookID).
		Count(&n)
	return n > 0
}

// studentActiveReservationForBook returns the student's pending/approved reservation
// for this book, if any.
func studentActiveReservationForBook(studentID, bookID uint) (models.Reservation, bool) {
	var res models.Reservation
	err := database.DB.
		Joins("JOIN book_copies ON book_copies.id = reservations.book_copy_id").
		Joins("JOIN reservation_statuses ON reservation_statuses.id = reservations.status_id").
		Where("reservations.student_id = ? AND book_copies.book_id = ? AND reservation_statuses.code IN ?", studentID, bookID, activeHoldCodes).
		First(&res).Error
	return res, err == nil
}

// GetStudentHolds returns a student's current holds (active loans + open
// reservations), their count, and their effective limit. Powers the librarian's
// "how many books does this student have?" view. Scope-checked like reading data.
func GetStudentHolds(c *fiber.Ctx) error {
	sid, _ := strconv.Atoi(c.Params("id"))
	studentID := uint(sid)

	if ok, err := canAccessStudent(c, studentID); err != nil {
		return err
	} else if !ok {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	var loans []models.Loan
	database.DB.
		Preload("BookCopy.Book").
		Where("student_id = ? AND return_date IS NULL", studentID).
		Find(&loans)

	var reservations []models.Reservation
	database.DB.
		Preload("BookCopy.Book").
		Preload("Status").
		Joins("JOIN reservation_statuses ON reservation_statuses.id = reservations.status_id").
		Where("reservations.student_id = ? AND reservation_statuses.code IN ?", studentID, activeHoldCodes).
		Find(&reservations)

	type LoanRow struct {
		LoanID         uint      `json:"loan_id"`
		BookTitle      string    `json:"book_title"`
		TrackingNumber string    `json:"tracking_number"`
		DueDate        time.Time `json:"due_date"`
	}
	type ResRow struct {
		ReservationID uint   `json:"reservation_id"`
		BookTitle     string `json:"book_title"`
		StatusCode    string `json:"status_code"`
	}

	lr := []LoanRow{}
	for _, l := range loans {
		lr = append(lr, LoanRow{l.ID, l.BookCopy.Book.Title, l.BookCopy.TrackingNumber, l.DueDate})
	}
	rr := []ResRow{}
	for _, r := range reservations {
		code := ""
		if r.StatusID != nil {
			code = r.Status.Code
		}
		rr = append(rr, ResRow{r.ID, r.BookCopy.Book.Title, code})
	}

	return c.JSON(fiber.Map{
		"count":        studentHoldCount(studentID),
		"limit":        studentEffectiveLimit(studentID),
		"active_loans": lr,
		"reservations": rr,
	})
}

// GetLoanLimit returns the caller librarian's branch borrow limit.
func GetLoanLimit(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	var br models.Branch
	if err := database.DB.First(&br, branchID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Branch not found"})
	}
	return c.JSON(fiber.Map{"loan_limit": br.LoanLimit})
}

// SetLoanLimit sets the branch-wide default borrow limit (librarian's own branch).
func SetLoanLimit(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	type Req struct {
		Limit int `json:"limit"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Limit < 0 {
		req.Limit = 0
	}
	database.DB.Model(&models.Branch{}).Where("id = ?", branchID).Update("loan_limit", req.Limit)
	return c.JSON(fiber.Map{"loan_limit": req.Limit})
}

// SetStudentLimit sets (or clears, with null) a per-student borrow-limit override.
// The student must belong to the caller librarian's branch.
func SetStudentLimit(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	sid, _ := strconv.Atoi(c.Params("id"))

	var stu models.Student
	if err := database.DB.First(&stu, "user_id = ?", uint(sid)).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}
	if stu.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "Student not in your branch"})
	}

	type Req struct {
		Limit *int `json:"limit"` // null clears the override (back to branch default)
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	if req.Limit == nil {
		database.DB.Exec("UPDATE students SET loan_limit = NULL WHERE user_id = ?", sid)
	} else {
		v := *req.Limit
		if v < 0 {
			v = 0
		}
		database.DB.Model(&models.Student{}).Where("user_id = ?", sid).Update("loan_limit", v)
	}
	return c.JSON(fiber.Map{"user_id": stu.UserID, "limit": req.Limit})
}
