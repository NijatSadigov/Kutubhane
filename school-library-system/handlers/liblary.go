package handlers

import (
	"school-library-system/database"
	"school-library-system/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

// --- UTILS ---

func getUserBranchID(c *fiber.Ctx) (uint, error) {
	claimsID := c.Locals("user_id")
	if claimsID == nil {
		return 0, fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	var userID uint
	if val, ok := claimsID.(float64); ok {
		userID = uint(val)
	} else {
		userID = uint(claimsID.(int))
	}

	var lib models.Librarian
	if err := database.DB.Where("user_id = ?", userID).First(&lib).Error; err == nil {
		return lib.BranchID, nil
	}

	var stu models.Student
	if err := database.DB.Where("user_id = ?", userID).First(&stu).Error; err == nil {
		return stu.BranchID, nil
	}

	return 0, fiber.NewError(fiber.StatusForbidden, "User profile not found")
}

// --- BOOK MANAGEMENT ---

func AddBook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	type BookReq struct {
		Title               string `json:"title"`
		CoverURL            string `json:"cover_url"`
		ISBN                string `json:"isbn"`
		CallNo              string `json:"call_no"`
		Language            string `json:"language"`
		CEFRLevel           string `json:"cefr_level"`
		PublicationYear     int    `json:"publication_year"`
		Edition             string `json:"edition"`
		PageCount           int    `json:"page_count"`
		PhysicalDescription string `json:"physical_description"`
		AdditionalNotes     string `json:"additional_notes"`
		HasEBook            bool   `json:"has_ebook"`
		EBookURL            string `json:"ebook_url"`
		AuthorID            *uint  `json:"author_id"`
		PublisherID         *uint  `json:"publisher_id"`
		TopicID             *uint  `json:"topic_id"`
		GenreID             *uint  `json:"genre_id"`
		FrequencyID         *uint  `json:"frequency_id"`
	}

	var req BookReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Data")
	}

	book := models.Book{
		BranchID:            branchID,
		Title:               req.Title,
		CoverURL:            req.CoverURL,
		ISBN:                req.ISBN,
		CallNo:              req.CallNo,
		Language:            req.Language,
		CEFRLevel:           req.CEFRLevel,
		PublicationYear:     req.PublicationYear,
		Edition:             req.Edition,
		PageCount:           req.PageCount,
		PhysicalDescription: req.PhysicalDescription,
		AdditionalNotes:     req.AdditionalNotes,
		HasEBook:            req.HasEBook,
		EBookURL:            req.EBookURL,
		AuthorID:            req.AuthorID,
		PublisherID:         req.PublisherID,
		TopicID:             req.TopicID,
		GenreID:             req.GenreID,
		FrequencyID:         req.FrequencyID,
	}

	database.DB.Create(&book)
	return c.JSON(book)
}

func UpdateBook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	id := c.Params("id")
	var book models.Book

	if err := database.DB.Where("id = ? AND branch_id = ?", id, branchID).First(&book).Error; err != nil {
		return c.Status(404).SendString("Book not found or access denied")
	}

	type UpdateReq struct {
		Title               string `json:"title"`
		CoverURL            string `json:"cover_url"`
		ISBN                string `json:"isbn"`
		CallNo              string `json:"call_no"`
		Language            string `json:"language"`
		CEFRLevel           string `json:"cefr_level"`
		PublicationYear     int    `json:"publication_year"`
		Edition             string `json:"edition"`
		PageCount           int    `json:"page_count"`
		PhysicalDescription string `json:"physical_description"`
		AdditionalNotes     string `json:"additional_notes"`
		HasEBook            bool   `json:"has_ebook"`
		EBookURL            string `json:"ebook_url"`
		AuthorID            *uint  `json:"author_id"`
		PublisherID         *uint  `json:"publisher_id"`
		TopicID             *uint  `json:"topic_id"`
		GenreID             *uint  `json:"genre_id"`
		FrequencyID         *uint  `json:"frequency_id"`
	}

	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	book.Title = req.Title
	book.CoverURL = req.CoverURL
	book.ISBN = req.ISBN
	book.CallNo = req.CallNo
	book.Language = req.Language
	book.CEFRLevel = req.CEFRLevel
	book.PublicationYear = req.PublicationYear
	book.Edition = req.Edition
	book.PageCount = req.PageCount
	book.PhysicalDescription = req.PhysicalDescription
	book.AdditionalNotes = req.AdditionalNotes
	book.HasEBook = req.HasEBook
	book.EBookURL = req.EBookURL
	book.AuthorID = req.AuthorID
	book.PublisherID = req.PublisherID
	book.TopicID = req.TopicID
	book.GenreID = req.GenreID
	book.FrequencyID = req.FrequencyID

	database.DB.Save(&book)
	return c.JSON(book)
}

func GetBooks(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	var books []models.Book
	database.DB.
		Preload("Author").
		Preload("Publisher").
		Preload("Topic").
		Preload("Genre").
		Preload("Frequency").
		Preload("Copies").
		Preload("Copies.Condition").
		Preload("Copies.Status").
		Where("branch_id = ?", branchID).
		Find(&books)

	return c.JSON(books)
}

func GetBookDetails(c *fiber.Ctx) error {
	id := c.Params("id")
	var book models.Book
	if err := database.DB.
		Preload("Author").
		Preload("Publisher").
		Preload("Topic").
		Preload("Genre").
		Preload("Frequency").
		Preload("Copies").
		Preload("Copies.Condition").
		Preload("Copies.Status").
		First(&book, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Book not found"})
	}
	return c.JSON(book)
}

func DeleteBook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	id := c.Params("id")

	if err := database.DB.Where("id = ? AND branch_id = ?", id, branchID).First(&models.Book{}).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Access Denied"})
	}

	database.DB.Delete(&models.BookCopy{}, "book_id = ?", id)
	database.DB.Delete(&models.Book{}, id)
	return c.JSON(fiber.Map{"message": "Book Deleted"})
}

func BulkUploadBooks(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	var books []models.Book
	if err := c.BodyParser(&books); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Data Format"})
	}
	for i := range books {
		books[i].BranchID = branchID
	}
	if err := database.DB.Create(&books).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database Error"})
	}
	return c.JSON(fiber.Map{"message": "Bulk Upload Successful", "count": len(books)})
}

// --- BOOK COPIES ---

func AddCopy(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	type CopyReq struct {
		BookID         uint   `json:"book_id"`
		TrackingNumber string `json:"tracking_number"`
		ConditionID    *uint  `json:"condition_id"`
		StatusID       *uint  `json:"status_id"`
	}

	var req CopyReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Data"})
	}

	var book models.Book
	if err := database.DB.Where("id = ? AND branch_id = ?", req.BookID, branchID).First(&book).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Cannot add copies to books from other branches"})
	}

	copy := models.BookCopy{
		BookID:         req.BookID,
		TrackingNumber: req.TrackingNumber,
		ConditionID:    req.ConditionID,
		StatusID:       req.StatusID,
	}

	database.DB.Create(&copy)
	return c.JSON(fiber.Map{"message": "Copy added", "tracking_number": req.TrackingNumber})
}

func UpdateCopy(c *fiber.Ctx) error {
	id := c.Params("id")

	type UpdateReq struct {
		TrackingNumber string `json:"tracking_number"`
		ConditionID    *uint  `json:"condition_id"`
		StatusID       *uint  `json:"status_id"`
	}

	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.SendStatus(400)
	}

	var copy models.BookCopy
	if err := database.DB.First(&copy, id).Error; err != nil {
		return c.SendStatus(404)
	}

	if req.TrackingNumber != "" {
		copy.TrackingNumber = req.TrackingNumber
	}
	if req.ConditionID != nil {
		copy.ConditionID = req.ConditionID
	}
	if req.StatusID != nil {
		copy.StatusID = req.StatusID
	}

	database.DB.Save(&copy)
	return c.JSON(copy)
}

func DeleteCopy(c *fiber.Ctx) error {
	id := c.Params("id")
	var copy models.BookCopy
	database.DB.Preload("Status").First(&copy, id)

	if copy.Status.Code == "LOANED" {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot delete a loaned book"})
	}

	database.DB.Delete(&copy)
	return c.JSON(fiber.Map{"message": "Copy deleted"})
}

// --- LOAN SYSTEM ---

func GetActiveLoans(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	var loans []models.Loan

	if err := database.DB.
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.branch_id = ? AND loans.return_date IS NULL", branchID).
		Preload("Student").
		Preload("Status").
		Preload("BookCopy").
		Preload("BookCopy.Book").
		Preload("BookCopy.Book.Author").
		Preload("BookCopy.Book.Genre").
		Find(&loans).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not fetch loans"})
	}
	return c.JSON(loans)
}

func CreateLoan(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	type LoanReq struct {
		StudentID      uint   `json:"student_id"`
		BookID         uint   `json:"book_id"`
		TrackingNumber string `json:"tracking_number"`
		DueDate        string `json:"due_date"`
		Description    string `json:"description"`
	}

	var req LoanReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var copy models.BookCopy
	if err := database.DB.
		Preload("Book").
		Preload("Status").
		Where("book_id = ? AND tracking_number = ?", req.BookID, req.TrackingNumber).
		First(&copy).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Book copy not found by BookID and Tracking Number"})
	}

	if copy.Book.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "This book belongs to another branch!"})
	}

	if copy.Status.Code != "AVAILABLE" && copy.Status.Code != "RESERVED" {
		return c.Status(400).JSON(fiber.Map{"error": "Book is not available"})
	}

	var activeLoanStatus models.LoanStatus
	database.DB.Where("code = 'ACTIVE' AND branch_id = ?", branchID).First(&activeLoanStatus)

	var loanedCopyStatus models.CopyStatus
	database.DB.Where("code = 'LOANED' AND branch_id = ?", branchID).First(&loanedCopyStatus)

	dueDate := time.Now().AddDate(0, 0, 14)
	if req.DueDate != "" {
		if parsed, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			dueDate = parsed
		}
	}

	tx := database.DB.Begin()

	loan := models.Loan{
		StudentID:   req.StudentID,
		BookCopyID:  copy.ID,
		IssueDate:   time.Now(),
		DueDate:     dueDate,
		ReturnDate:  nil,
		StatusID:    &activeLoanStatus.ID,
		Description: req.Description,
	}

	if err := tx.Create(&loan).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Could not create loan"})
	}

	if err := tx.Model(&models.BookCopy{}).Where("id = ?", copy.ID).Update("status_id", loanedCopyStatus.ID).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Could not update copy status"})
	}

	tx.Commit()
	return c.JSON(loan)
}

func UpdateLoan(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	id := c.Params("id")
	type UpdateReq struct {
		DueDate     string `json:"due_date"`
		Description string `json:"description"`
	}

	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Data")
	}

	var loan models.Loan
	if err := database.DB.
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("loans.id = ? AND books.branch_id = ?", id, branchID).
		First(&loan).Error; err != nil {
		return c.Status(403).SendString("Access denied or Loan not found")
	}

	if req.DueDate != "" {
		newDate, _ := time.Parse("2006-01-02", req.DueDate)
		loan.DueDate = newDate
	}
	if req.Description != "" {
		loan.Description = req.Description
	}

	if err := database.DB.Save(&loan).Error; err != nil {
		return c.Status(500).SendString("Update failed")
	}
	return c.JSON(fiber.Map{"message": "Loan updated"})
}

func ReturnBook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	type ReturnReq struct {
		BookID         uint   `json:"book_id"`
		TrackingNumber string `json:"tracking_number"`
	}

	var req ReturnReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var copy models.BookCopy
	if err := database.DB.Preload("Book").Where("book_id = ? AND tracking_number = ?", req.BookID, req.TrackingNumber).First(&copy).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Copy not found by BookID and Tracking Number"})
	}

	if copy.Book.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "Cannot return book from another school"})
	}

	tx := database.DB.Begin()

	var loan models.Loan
	if err := tx.Where("book_copy_id = ? AND return_date IS NULL", copy.ID).First(&loan).Error; err != nil {
		tx.Rollback()
		return c.Status(404).JSON(fiber.Map{"error": "No active loan found for this book copy."})
	}

	var returnedLoanStatus models.LoanStatus
	tx.Where("code = 'RETURNED' AND branch_id = ?", branchID).First(&returnedLoanStatus)

	var availableCopyStatus models.CopyStatus
	tx.Where("code = 'AVAILABLE' AND branch_id = ?", branchID).First(&availableCopyStatus)

	now := time.Now()
	loan.ReturnDate = &now
	loan.StatusID = &returnedLoanStatus.ID
	tx.Save(&loan)

	tx.Model(&models.BookCopy{}).Where("id = ?", copy.ID).Update("status_id", availableCopyStatus.ID)
	tx.Commit()

	return c.JSON(fiber.Map{"message": "Book returned successfully", "student_id": loan.StudentID})
}

// --- STUDENT & LIBRARY STATS ---

func GetStudentStats(c *fiber.Ctx) error {
	studentID := c.Params("id")
	var loans []models.Loan
	database.DB.Preload("BookCopy.Book.Genre").Where("student_id = ?", studentID).Find(&loans)

	totalRead := len(loans)
	genreCounts := make(map[string]int)
	var favGenre string
	maxCount := 0

	for _, loan := range loans {
		if loan.BookCopy.Book.GenreID != nil {
			g := loan.BookCopy.Book.Genre.Name
			genreCounts[g]++
			if genreCounts[g] > maxCount {
				maxCount = genreCounts[g]
				favGenre = g
			}
		}
	}

	return c.JSON(fiber.Map{
		"total_books_read": totalRead,
		"favorite_genre":   favGenre,
	})
}

func GetClassList(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	grade := c.Query("grade")
	group := c.Query("group")
	var students []models.Student

	query := database.DB.Model(&models.Student{}).Where("branch_id = ?", branchID)

	if grade != "" {
		query = query.Where("grade = ?", grade)
	}
	if group != "" {
		query = query.Where("class_group = ?", group)
	}

	query.Preload("Loans").Preload("Loans.Status").Find(&students)
	return c.JSON(students)
}

func GetMyLibrary(c *fiber.Ctx) error {
	studentID := c.Params("id")

	var loans []models.Loan
	if err := database.DB.
		Preload("BookCopy").
		Preload("BookCopy.Book").
		Preload("BookCopy.Book.Author").
		Preload("BookCopy.Book.Genre").
		Preload("Status").
		Where("student_id = ?", studentID).
		Find(&loans).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not fetch loans"})
	}

	type LoanDTO struct {
		ID         uint       `json:"id"`
		BookTitle  string     `json:"book_title"`
		Author     string     `json:"author"`
		Genre      string     `json:"genre"`
		PageCount  int        `json:"page_count"`
		IssueDate  time.Time  `json:"issue_date"`
		DueDate    time.Time  `json:"due_date"`
		ReturnDate *time.Time `json:"return_date"`
		Status     string     `json:"status"`      // Display name, librarian-editable
		StatusCode string     `json:"status_code"` // Fixed code the UI can branch on
	}

	response := []LoanDTO{}

	for _, l := range loans {
		title := "Unknown Book (Deleted)"
		author := "Unknown"
		genre := "Uncategorized"
		pages := 0

		if l.BookCopy.Book.ID != 0 {
			title = l.BookCopy.Book.Title
			pages = l.BookCopy.Book.PageCount
			if l.BookCopy.Book.AuthorID != nil {
				author = l.BookCopy.Book.Author.Name
			}
			if l.BookCopy.Book.GenreID != nil {
				genre = l.BookCopy.Book.Genre.Name
			}
		}

		statusName := "Unknown"
		statusCode := ""
		if l.StatusID != nil {
			statusName = l.Status.Name
			statusCode = l.Status.Code
		}

		response = append(response, LoanDTO{
			ID:         l.ID,
			BookTitle:  title,
			Author:     author,
			Genre:      genre,
			PageCount:  pages,
			IssueDate:  l.IssueDate,
			DueDate:    l.DueDate,
			ReturnDate: l.ReturnDate,
			Status:     statusName,
			StatusCode: statusCode,
		})
	}

	return c.JSON(response)
}

// --- RESERVATION SYSTEM ---

func GetAllReservations(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	var reservations []models.Reservation

	if err := database.DB.
		Joins("JOIN book_copies ON book_copies.id = reservations.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.branch_id = ?", branchID).
		Preload("Student").
		Preload("Status").
		Preload("BookCopy").
		Preload("BookCopy.Book").
		Preload("BookCopy.Book.Author").
		Preload("BookCopy.Book.Genre").
		Find(&reservations).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not fetch reservations"})
	}
	return c.JSON(reservations)
}

func RequestReservation(c *fiber.Ctx) error {
	type Req struct {
		StudentID      uint   `json:"student_id"`
		BookID         uint   `json:"book_id"`
		TrackingNumber string `json:"tracking_number"`
		Description    string `json:"description"`
	}

	var r Req
	if err := c.BodyParser(&r); err != nil {
		return c.SendStatus(400)
	}

	var copy models.BookCopy
	if err := database.DB.Preload("Status").Preload("Book").Where("book_id = ? AND tracking_number = ?", r.BookID, r.TrackingNumber).First(&copy).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Copy not found"})
	}

	if copy.Status.Code != "AVAILABLE" {
		return c.Status(400).JSON(fiber.Map{"error": "Book not available for reservation"})
	}

	var pendingStatus models.ReservationStatus
	database.DB.Where("code = 'PENDING' AND branch_id = ?", copy.Book.BranchID).First(&pendingStatus)

	reservation := models.Reservation{
		StudentID:   r.StudentID,
		BookCopyID:  copy.ID,
		RequestDate: time.Now(),
		StatusID:    &pendingStatus.ID,
		Description: r.Description,
	}

	database.DB.Create(&reservation)
	return c.JSON(reservation)
}

func HandleReservation(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	id := c.Params("id")
	type ActionReq struct {
		Action string `json:"action"` // "Approved" or "Rejected"
	}
	var req ActionReq
	if err := c.BodyParser(&req); err != nil {
		return c.SendStatus(400)
	}

	var res models.Reservation
	if err := database.DB.
		Joins("JOIN book_copies ON book_copies.id = reservations.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("reservations.id = ? AND books.branch_id = ?", id, branchID).
		First(&res).Error; err != nil {
		return c.Status(403).SendString("Access Denied or Not Found")
	}

	if req.Action == "Approved" {
		var appStatus models.ReservationStatus
		database.DB.Where("code = 'APPROVED' AND branch_id = ?", branchID).First(&appStatus)
		res.StatusID = &appStatus.ID
		database.DB.Save(&res)

		var resCopyStatus models.CopyStatus
		database.DB.Where("code = 'RESERVED' AND branch_id = ?", branchID).First(&resCopyStatus)

		var copy models.BookCopy
		database.DB.First(&copy, res.BookCopyID)
		copy.StatusID = &resCopyStatus.ID
		database.DB.Save(&copy)

	} else if req.Action == "Rejected" {
		var rejStatus models.ReservationStatus
		database.DB.Where("code = 'REJECTED' AND branch_id = ?", branchID).First(&rejStatus)
		res.StatusID = &rejStatus.ID
		database.DB.Save(&res)

		var availCopyStatus models.CopyStatus
		database.DB.Where("code = 'AVAILABLE' AND branch_id = ?", branchID).First(&availCopyStatus)

		var copy models.BookCopy
		database.DB.Preload("Status").First(&copy, res.BookCopyID)
		if copy.Status.Code == "RESERVED" {
			copy.StatusID = &availCopyStatus.ID
			database.DB.Save(&copy)
		}
	}
	return c.JSON(res)
}

func IssueReservation(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	resID := c.Params("id")
	type IssueReq struct {
		DueDate string `json:"due_date"`
	}
	var req IssueReq
	c.BodyParser(&req)

	tx := database.DB.Begin()

	var res models.Reservation
	if err := tx.
		Joins("JOIN book_copies ON book_copies.id = reservations.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("reservations.id = ? AND books.branch_id = ?", resID, branchID).
		First(&res).Error; err != nil {
		tx.Rollback()
		return c.Status(403).SendString("Access Denied or Not Found")
	}

	dueDate := time.Now().AddDate(0, 0, 14)
	if req.DueDate != "" {
		if parsed, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			dueDate = parsed
		}
	}

	var activeLoanStatus models.LoanStatus
	tx.Where("code = 'ACTIVE' AND branch_id = ?", branchID).First(&activeLoanStatus)

	loan := models.Loan{
		StudentID:  res.StudentID,
		BookCopyID: res.BookCopyID,
		IssueDate:  time.Now(),
		DueDate:    dueDate,
		ReturnDate: nil,
		StatusID:   &activeLoanStatus.ID,
	}

	if err := tx.Create(&loan).Error; err != nil {
		tx.Rollback()
		return c.Status(500).SendString("Loan creation failed")
	}

	var completedResStatus models.ReservationStatus
	tx.Where("code = 'COMPLETED' AND branch_id = ?", branchID).First(&completedResStatus)

	var loanedCopyStatus models.CopyStatus
	tx.Where("code = 'LOANED' AND branch_id = ?", branchID).First(&loanedCopyStatus)

	tx.Model(&res).Update("status_id", completedResStatus.ID)
	tx.Model(&models.BookCopy{}).Where("id = ?", res.BookCopyID).Update("status_id", loanedCopyStatus.ID)

	tx.Commit()
	return c.JSON(fiber.Map{"message": "Book issued successfully"})
}
