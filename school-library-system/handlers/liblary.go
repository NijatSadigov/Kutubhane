package handlers

import (
	"school-library-system/database"
	"school-library-system/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

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

func AddBook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	type BookReq struct {
		Title           string `json:"title"`
		Author          string `json:"author"`
		ISBN            string `json:"isbn"`
		Publisher       string `json:"publisher"`
		PublicationYear int    `json:"publication_year"`
		Genre           string `json:"genre"`
		PageCount       int    `json:"page_count"`
	}
	var req BookReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Data")
	}

	book := models.Book{
		Title:           req.Title,
		Author:          req.Author,
		BranchID:        branchID,
		ISBN:            req.ISBN,
		Publisher:       req.Publisher,
		PublicationYear: req.PublicationYear,
		Genre:           req.Genre,
		PageCount:       req.PageCount,
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
		Title           string `json:"title"`
		Author          string `json:"author"`
		ISBN            string `json:"isbn"`
		Publisher       string `json:"publisher"`
		PublicationYear int    `json:"publication_year"`
		Genre           string `json:"genre"`
		PageCount       int    `json:"page_count"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	if req.Title != "" {
		book.Title = req.Title
	}
	if req.Author != "" {
		book.Author = req.Author
	}
	if req.ISBN != "" {
		book.ISBN = req.ISBN
	}
	if req.Publisher != "" {
		book.Publisher = req.Publisher
	}
	if req.PublicationYear != 0 {
		book.PublicationYear = req.PublicationYear
	}
	if req.Genre != "" {
		book.Genre = req.Genre
	}
	if req.PageCount != 0 {
		book.PageCount = req.PageCount
	}

	database.DB.Save(&book)
	return c.JSON(book)
}

func AddCopy(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	type CopyReq struct {
		BookID    uint   `json:"book_id"`
		Quantity  int    `json:"quantity"`
		Condition string `json:"condition"`
	}
	var req CopyReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Data"})
	}

	var book models.Book
	if err := database.DB.Where("id = ? AND branch_id = ?", req.BookID, branchID).First(&book).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Cannot add copies to books from other branches"})
	}

	var copies []models.BookCopy
	for i := 0; i < req.Quantity; i++ {
		copies = append(copies, models.BookCopy{
			BookID:    req.BookID,
			Condition: req.Condition,
			Status:    "Available",
		})
	}
	database.DB.Create(&copies)
	return c.JSON(fiber.Map{"message": "Copies added", "count": req.Quantity})
}

func GetBooks(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	var books []models.Book
	database.DB.Preload("Copies").Where("branch_id = ?", branchID).Find(&books)
	return c.JSON(books)
}

func GetBookDetails(c *fiber.Ctx) error {
	id := c.Params("id")
	var book models.Book
	if err := database.DB.Preload("Copies").First(&book, id).Error; err != nil {
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

func UpdateCopy(c *fiber.Ctx) error {
	id := c.Params("id")
	type UpdateReq struct {
		Condition string `json:"condition"`
		Status    string `json:"status"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.SendStatus(400)
	}
	var copy models.BookCopy
	if err := database.DB.First(&copy, id).Error; err != nil {
		return c.SendStatus(404)
	}
	if req.Condition != "" {
		copy.Condition = req.Condition
	}
	if req.Status != "" {
		copy.Status = req.Status
	}
	database.DB.Save(&copy)
	return c.JSON(copy)
}

func DeleteCopy(c *fiber.Ctx) error {
	id := c.Params("id")
	var copy models.BookCopy
	database.DB.First(&copy, id)
	if copy.Status == "Loaned" {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot delete a loaned book"})
	}
	database.DB.Delete(&copy)
	return c.JSON(fiber.Map{"message": "Copy deleted"})
}

// --- LOAN SYSTEM

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
		Preload("BookCopy").
		Preload("BookCopy.Book").
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
		StudentID uint   `json:"student_id"`
		CopyID    uint   `json:"book_copy_id"`
		DueDate   string `json:"due_date"`
	}
	var req LoanReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var copy models.BookCopy
	if err := database.DB.Preload("Book").First(&copy, req.CopyID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Book copy not found"})
	}
	if copy.Book.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "This book belongs to another branch!"})
	}
	if copy.Status != "Available" && copy.Status != "Reserved" {
		return c.Status(400).JSON(fiber.Map{"error": "Book is not available"})
	}

	dueDate := time.Now().AddDate(0, 0, 14)
	if req.DueDate != "" {
		if parsed, err := time.Parse("2006-01-02", req.DueDate); err == nil {
			dueDate = parsed
		}
	}

	tx := database.DB.Begin()
	loan := models.Loan{
		StudentID:  req.StudentID,
		BookCopyID: req.CopyID,
		IssueDate:  time.Now(),
		DueDate:    dueDate,
		ReturnDate: nil,
		Status:     "Active",
	}
	if err := tx.Create(&loan).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Could not create loan"})
	}
	if err := tx.Model(&models.BookCopy{}).Where("id = ?", req.CopyID).Update("status", "Loaned").Error; err != nil {
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
		DueDate string `json:"due_date"`
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

	newDate, _ := time.Parse("2006-01-02", req.DueDate)
	if err := database.DB.Model(&loan).Update("due_date", newDate).Error; err != nil {
		return c.Status(500).SendString("Update failed")
	}
	return c.JSON(fiber.Map{"message": "Date updated"})
}

func ReturnBook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	copyID := c.Params("id")

	var copy models.BookCopy
	if err := database.DB.Preload("Book").First(&copy, copyID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Copy not found"})
	}
	if copy.Book.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "Cannot return book from another school"})
	}

	tx := database.DB.Begin()
	var loan models.Loan
	if err := tx.Where("book_copy_id = ? AND return_date IS NULL", copyID).First(&loan).Error; err != nil {
		tx.Rollback()
		return c.Status(404).JSON(fiber.Map{"error": "No active loan found for this book copy."})
	}

	now := time.Now()
	loan.ReturnDate = &now
	loan.Status = "Returned"
	tx.Save(&loan)

	tx.Model(&models.BookCopy{}).Where("id = ?", loan.BookCopyID).Update("status", "Available")
	tx.Commit()
	return c.JSON(fiber.Map{"message": "Book returned successfully", "student_id": loan.StudentID})
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
		Preload("BookCopy").
		Preload("BookCopy.Book").
		Find(&reservations).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not fetch reservations"})
	}
	return c.JSON(reservations)
}

func RequestReservation(c *fiber.Ctx) error {
	type Req struct {
		StudentID  uint `json:"student_id"`
		BookCopyID uint `json:"book_copy_id"`
	}
	var r Req
	if err := c.BodyParser(&r); err != nil {
		return c.SendStatus(400)
	}
	var copy models.BookCopy
	database.DB.First(&copy, r.BookCopyID)
	if copy.Status != "Available" {
		return c.Status(400).JSON(fiber.Map{"error": "Book not available for reservation"})
	}
	reservation := models.Reservation{
		StudentID:   r.StudentID,
		BookCopyID:  r.BookCopyID,
		RequestDate: time.Now(),
		Status:      "Pending",
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
		Action string `json:"action"` // "approve" or "reject"
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

	if req.Action == "Approved" || req.Action == "approve" {
		res.Status = "Approved"
		database.DB.Save(&res)
		var copy models.BookCopy
		database.DB.First(&copy, res.BookCopyID)
		copy.Status = "Reserved"
		database.DB.Save(&copy)
	} else if req.Action == "Rejected" || req.Action == "reject" {
		res.Status = "Rejected"
		database.DB.Save(&res)
		var copy models.BookCopy
		database.DB.First(&copy, res.BookCopyID)
		if copy.Status == "Reserved" {
			copy.Status = "Available"
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

	loan := models.Loan{
		StudentID:  res.StudentID,
		BookCopyID: res.BookCopyID,
		IssueDate:  time.Now(),
		DueDate:    dueDate,
		ReturnDate: nil,
		Status:     "Active",
	}
	if err := tx.Create(&loan).Error; err != nil {
		tx.Rollback()
		return c.Status(500).SendString("Loan creation failed")
	}

	tx.Model(&res).Update("status", "Completed")
	tx.Model(&models.BookCopy{}).Where("id = ?", res.BookCopyID).Update("status", "Loaned")
	tx.Commit()
	return c.JSON(fiber.Map{"message": "Book issued successfully"})
}

func GetStudentStats(c *fiber.Ctx) error {
	studentID := c.Params("id")
	var loans []models.Loan
	database.DB.Preload("BookCopy.Book").Where("student_id = ?", studentID).Find(&loans)
	totalRead := len(loans)
	genreCounts := make(map[string]int)
	var favGenre string
	maxCount := 0
	for _, loan := range loans {
		g := loan.BookCopy.Book.Genre
		genreCounts[g]++
		if genreCounts[g] > maxCount {
			maxCount = genreCounts[g]
			favGenre = g
		}
	}
	return c.JSON(fiber.Map{
		"total_books_read": totalRead,
		"favorite_genre":   favGenre,
	})
}

func GetClassList(c *fiber.Ctx) error {
	grade := c.Query("grade")
	group := c.Query("group")
	var students []models.Student
	query := database.DB.Model(&models.Student{})
	if grade != "" {
		query = query.Where("grade = ?", grade)
	}
	if group != "" {
		query = query.Where("class_group = ?", group)
	}
	query.Preload("Loans").Find(&students)
	return c.JSON(students)
}

func GetMyLibrary(c *fiber.Ctx) error {
	studentID := c.Params("id")

	var loans []models.Loan
	if err := database.DB.
		Preload("BookCopy").
		Preload("BookCopy.Book").
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
		Status     string     `json:"status"`
	}

	var response []LoanDTO

	for _, l := range loans {
		title := "Unknown Book (Deleted)"
		author := "Unknown"
		genre := "Uncategorized"
		pages := 0

		if l.BookCopy.Book.ID != 0 {
			title = l.BookCopy.Book.Title
			author = l.BookCopy.Book.Author
			genre = l.BookCopy.Book.Genre
			pages = l.BookCopy.Book.PageCount
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
			Status:     l.Status,
		})
	}

	return c.JSON(response)
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
