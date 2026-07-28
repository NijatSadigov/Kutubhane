package handlers

import (
	"math"
	"school-library-system/database"
	"school-library-system/models"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

// currentUserID extracts the authenticated user id from the JWT identity stored
// in c.Locals by the IsAuthenticated middleware.
func currentUserID(c *fiber.Ctx) (uint, error) {
	raw := c.Locals("user_id")
	if raw == nil {
		return 0, fiber.NewError(fiber.StatusUnauthorized, "Unauthenticated")
	}
	switch v := raw.(type) {
	case float64:
		return uint(v), nil
	case int:
		return uint(v), nil
	case uint:
		return v, nil
	}
	return 0, fiber.NewError(fiber.StatusUnauthorized, "Bad identity")
}

// canAccessStudent reports whether the caller may see a given student's reading
// data: the student themselves, a librarian in the same branch, a manager in the
// same school, or an admin. Scope is derived from the JWT identity, never a param.
func canAccessStudent(c *fiber.Ctx, studentID uint) (bool, error) {
	uid, err := currentUserID(c)
	if err != nil {
		return false, err
	}
	role, _ := c.Locals("role").(string)

	if role == "admin" {
		return true, nil
	}
	if uid == studentID {
		return true, nil
	}

	var stu models.Student
	if err := database.DB.Where("user_id = ?", studentID).First(&stu).Error; err != nil {
		return false, nil // unknown student — deny
	}

	switch role {
	case "librarian":
		var lib models.Librarian
		if err := database.DB.Where("user_id = ?", uid).First(&lib).Error; err == nil {
			return lib.BranchID == stu.BranchID, nil
		}
	case "manager":
		var mgr models.Manager
		if err := database.DB.Where("user_id = ?", uid).First(&mgr).Error; err == nil {
			return branchInSchool(stu.BranchID, mgr.SchoolID), nil
		}
	}
	return false, nil
}

// AddReadingLog records a new reading-diary entry (page reached + optional note)
// for one of the authenticated student's own loans.
func AddReadingLog(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}

	type Req struct {
		LoanID uint   `json:"loan_id"`
		Page   int    `json:"page"`
		Note   string `json:"note"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var loan models.Loan
	if err := database.DB.Preload("BookCopy.Book").First(&loan, req.LoanID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Loan not found"})
	}
	// A diary entry can only be written by the student who holds the loan.
	if loan.StudentID != uid {
		return c.Status(403).JSON(fiber.Map{"error": "This loan is not yours"})
	}

	page := req.Page
	if page < 0 {
		page = 0
	}
	if pc := loan.BookCopy.Book.PageCount; pc > 0 && page > pc {
		page = pc
	}

	entry := models.ReadingLog{
		LoanID:    req.LoanID,
		StudentID: uid,
		Page:      page,
		Note:      req.Note,
	}
	if err := database.DB.Create(&entry).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save entry"})
	}
	return c.JSON(entry)
}

// GetLoanReadingLogs returns the diary entries for a single loan, oldest first.
// Visible to the owning student or authorized staff.
func GetLoanReadingLogs(c *fiber.Ctx) error {
	lid, _ := strconv.Atoi(c.Params("loanId"))

	var loan models.Loan
	if err := database.DB.First(&loan, lid).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Loan not found"})
	}
	if ok, err := canAccessStudent(c, loan.StudentID); err != nil {
		return err
	} else if !ok {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	var logs []models.ReadingLog
	database.DB.Where("loan_id = ?", lid).Order("created_at asc").Find(&logs)
	return c.JSON(logs)
}

// GetStudentReading returns a student's aggregated reading stats plus per-book
// progress and the raw diary entries. Powers both the student's own stats tab and
// the staff (librarian/manager) reader view. Access is scope-checked.
func GetStudentReading(c *fiber.Ctx) error {
	sid, _ := strconv.Atoi(c.Params("id"))
	studentID := uint(sid)

	if ok, err := canAccessStudent(c, studentID); err != nil {
		return err
	} else if !ok {
		return c.Status(403).JSON(fiber.Map{"error": "Access denied"})
	}

	var loans []models.Loan
	database.DB.
		Preload("BookCopy.Book.Genre").
		Preload("Status").
		Where("student_id = ?", studentID).
		Find(&loans)

	var logs []models.ReadingLog
	database.DB.Where("student_id = ?", studentID).Order("created_at asc").Find(&logs)

	// Aggregate the diary entries per loan: earliest/latest timestamp and the
	// furthest page reached.
	type agg struct {
		maxPage int
		first   time.Time
		last    time.Time
		hasLog  bool
	}
	byLoan := map[uint]*agg{}
	for _, lg := range logs {
		a := byLoan[lg.LoanID]
		if a == nil {
			a = &agg{first: lg.CreatedAt}
			byLoan[lg.LoanID] = a
		}
		if lg.Page > a.maxPage {
			a.maxPage = lg.Page
		}
		if !a.hasLog || lg.CreatedAt.Before(a.first) {
			a.first = lg.CreatedAt
		}
		a.last = lg.CreatedAt
		a.hasLog = true
	}

	booksRead := 0
	totalPages := 0
	var speedPages float64
	var speedDays float64
	genreCounts := map[string]int{}
	favGenre := ""
	maxG := 0

	type BookProg struct {
		LoanID      uint   `json:"loan_id"`
		Title       string `json:"title"`
		PageCount   int    `json:"page_count"`
		CurrentPage int    `json:"current_page"`
		Percent     int    `json:"percent"`
		StatusCode  string `json:"status_code"`
	}
	books := []BookProg{}

	for _, l := range loans {
		pc := l.BookCopy.Book.PageCount
		code := ""
		if l.StatusID != nil {
			code = l.Status.Code
		}
		returned := l.ReturnDate != nil || code == "RETURNED"

		a := byLoan[l.ID]
		current := 0
		if a != nil {
			current = a.maxPage
		}
		// A returned book with no diary entries is assumed finished — keeps parity
		// with the old "pages read = sum of returned books' page counts" behavior.
		if returned && current == 0 {
			current = pc
		}
		if pc > 0 && current > pc {
			current = pc
		}

		if returned {
			booksRead++
		}
		totalPages += current

		percent := 0
		if pc > 0 {
			percent = current * 100 / pc
		}

		// Reading speed: prefer diary timestamps (pages reached / days since issue);
		// fall back to loan duration for finished books that were never logged.
		if a != nil && a.hasLog {
			days := a.last.Sub(l.IssueDate).Hours() / 24
			if days < 0.5 {
				days = 0.5
			}
			speedPages += float64(current)
			speedDays += days
		} else if returned && pc > 0 {
			end := l.IssueDate
			if l.ReturnDate != nil {
				end = *l.ReturnDate
			}
			days := end.Sub(l.IssueDate).Hours() / 24
			if days < 0.5 {
				days = 0.5
			}
			speedPages += float64(pc)
			speedDays += days
		}

		if l.BookCopy.Book.GenreID != nil {
			g := l.BookCopy.Book.Genre.Name
			genreCounts[g]++
			if genreCounts[g] > maxG {
				maxG = genreCounts[g]
				favGenre = g
			}
		}

		books = append(books, BookProg{
			LoanID:      l.ID,
			Title:       l.BookCopy.Book.Title,
			PageCount:   pc,
			CurrentPage: current,
			Percent:     percent,
			StatusCode:  code,
		})
	}

	speed := 0.0
	if speedDays > 0 {
		speed = speedPages / speedDays
	}

	type LogDTO struct {
		ID        uint      `json:"id"`
		LoanID    uint      `json:"loan_id"`
		Page      int       `json:"page"`
		Note      string    `json:"note"`
		CreatedAt time.Time `json:"created_at"`
	}
	logDTOs := []LogDTO{}
	for _, lg := range logs {
		logDTOs = append(logDTOs, LogDTO{lg.ID, lg.LoanID, lg.Page, lg.Note, lg.CreatedAt})
	}

	return c.JSON(fiber.Map{
		"books_read":        booksRead,
		"pages_read":        totalPages,
		"reading_speed_ppd": math.Round(speed*10) / 10,
		"favorite_genre":    favGenre,
		"books":             books,
		"logs":              logDTOs,
	})
}
