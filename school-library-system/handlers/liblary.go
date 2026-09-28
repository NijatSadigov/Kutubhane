package handlers

import (
	"school-library-system/catalog"
	"strconv"

	"gorm.io/gorm"
	"school-library-system/database"
	"school-library-system/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

// --- UTILS ---

// holdKind tells the desk whether the other student's hold is merely queued or
// already approved and waiting on the shelf, so it can word the refusal.
func holdKind(r *models.Reservation) string {
	var st models.ReservationStatus
	if r.StatusID != nil && database.DB.First(&st, *r.StatusID).Error == nil {
		return st.Code
	}
	return ""
}

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
		// EditionID links this holding to a record already in the shared
		// catalog — the normal path, taken when the librarian picked a search
		// result. When it is absent the bibliographic fields below are used to
		// find or create an edition instead.
		EditionID *uint `json:"edition_id"`

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
		// Genre and topic are catalog ids now, not this branch's list, and are
		// stored on the Work rather than the holding.
		TopicID     *uint `json:"topic_id"`
		GenreID     *uint `json:"genre_id"`
		FrequencyID *uint `json:"frequency_id"`
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
		FrequencyID:         req.FrequencyID,
	}

	// Every holding must point at a shared catalog edition, however it was
	// created — otherwise the catalog drifts out of sync the moment someone
	// adds a book through the old form.
	var matchedBy string
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if req.EditionID != nil && *req.EditionID != 0 {
			// The librarian picked an existing record. Trust the catalog for
			// the bibliographic facts rather than whatever was in the form.
			var ed models.Edition
			if err := tx.First(&ed, *req.EditionID).Error; err != nil {
				return fiber.NewError(fiber.StatusBadRequest, "Unknown edition")
			}
			applyEditionToBook(&book, &ed)
			matchedBy = "linked"
		} else {
			in := catalog.EditionInput{
				Title:           req.Title,
				ISBN:            req.ISBN,
				Language:        req.Language,
				EditionLabel:    req.Edition,
				CoverURL:        req.CoverURL,
				CEFRLevel:       req.CEFRLevel,
				PublicationYear: req.PublicationYear,
				PageCount:       req.PageCount,
			}
			// The branch-scoped author/publisher lists are still how the form
			// names them; resolve to text so the global catalog can match.
			if req.AuthorID != nil {
				var a models.Author
				if err := tx.First(&a, *req.AuthorID).Error; err == nil {
					in.AuthorName = a.Name
				}
			}
			if req.PublisherID != nil {
				var p models.Publisher
				if err := tx.First(&p, *req.PublisherID).Error; err == nil {
					in.PublisherName = p.Name
				}
			}

			ed, info, err := catalog.Resolve(tx, in)
			if err != nil {
				return err
			}
			book.EditionID = &ed.ID
			matchedBy = info.MatchedBy
		}

		if err := setWorkSubjects(tx, book.EditionID, req.GenreID, req.TopicID); err != nil {
			return err
		}
		return tx.Create(&book).Error
	})
	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Could not add book"})
	}

	database.DB.Preload("CatalogEdition").First(&book, book.ID)

	// Embedding keeps the book's own fields at the top level, so callers that
	// already read res.data.id keep working; catalog_match is purely additive.
	return c.JSON(struct {
		models.Book
		CatalogMatch string `json:"catalog_match"`
	}{Book: book, CatalogMatch: matchedBy})
}

// applyEditionToBook copies the catalog's bibliographic facts onto a holding.
// The duplicated columns on Book are a migration artifact — Edition is the
// source of truth — but they are still what the current UI reads, so they are
// kept in step until those read paths move over.
// setWorkSubjects writes genre and topic onto the edition's Work, which is
// where they belong: they describe the book, not the branch's copy of it. Both
// are optional, and a nil leaves whatever the work already had.
func setWorkSubjects(tx *gorm.DB, editionID *uint, genreID, topicID *uint) error {
	if editionID == nil || (genreID == nil && topicID == nil) {
		return nil
	}
	var ed models.Edition
	if err := tx.First(&ed, *editionID).Error; err != nil {
		return nil
	}
	updates := map[string]interface{}{}
	if genreID != nil {
		updates["genre_id"] = *genreID
	}
	if topicID != nil {
		updates["topic_id"] = *topicID
	}
	if len(updates) == 0 {
		return nil
	}
	return tx.Model(&models.Work{}).Where("id = ?", ed.WorkID).Updates(updates).Error
}

// bookGenreName is the genre of the book a loan was for.
//
// Genre lives on the Work — it is a fact about the book, not about the branch
// that shelved it. The holding's own genre_id is the pre-migration value and is
// only consulted when a holding has no edition yet, which the catalog backfill
// is meant to have eliminated.
func bookGenreName(b models.Book) string {
	if b.CatalogEdition != nil && b.CatalogEdition.Work.Genre.Name != "" {
		return b.CatalogEdition.Work.Genre.Name
	}
	if b.GenreID != nil {
		return b.Genre.Name
	}
	return ""
}

func applyEditionToBook(book *models.Book, ed *models.Edition) {
	book.EditionID = &ed.ID
	book.Title = ed.Title
	book.Language = ed.Language
	book.PublicationYear = ed.PublicationYear
	book.PageCount = ed.PageCount
	book.Edition = ed.EditionLabel
	if ed.ISBN13 != "" {
		book.ISBN = ed.ISBN13
	}
	if ed.CoverURL != "" {
		book.CoverURL = ed.CoverURL
	}
	if ed.CEFRLevel != "" {
		book.CEFRLevel = ed.CEFRLevel
	}
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
	// Genre and topic go to the Work, not the holding.
	if err := setWorkSubjects(database.DB, book.EditionID, req.GenreID, req.TopicID); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save subjects"})
	}
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

	// A CSV import must go through the same catalog resolver as the book form,
	// or a bulk upload silently creates holdings with no edition and the shared
	// catalog drifts out of sync. Matching also means a spreadsheet of books
	// another branch already stocks collapses onto the existing editions.
	matched := 0
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		for i := range books {
			books[i].BranchID = branchID

			in := catalog.EditionInput{
				Title:           books[i].Title,
				ISBN:            books[i].ISBN,
				Language:        books[i].Language,
				EditionLabel:    books[i].Edition,
				CoverURL:        books[i].CoverURL,
				CEFRLevel:       books[i].CEFRLevel,
				PublicationYear: books[i].PublicationYear,
				PageCount:       books[i].PageCount,
			}
			if books[i].AuthorID != nil {
				var a models.Author
				if err := tx.First(&a, *books[i].AuthorID).Error; err == nil {
					in.AuthorName = a.Name
				}
			}
			if books[i].PublisherID != nil {
				var p models.Publisher
				if err := tx.First(&p, *books[i].PublisherID).Error; err == nil {
					in.PublisherName = p.Name
				}
			}

			ed, info, err := catalog.Resolve(tx, in)
			if err != nil {
				return err
			}
			books[i].EditionID = &ed.ID
			if !info.EditionCreated {
				matched++
			}
		}
		if len(books) == 0 {
			return nil
		}
		return tx.Create(&books).Error
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Database Error"})
	}

	return c.JSON(fiber.Map{
		"message": "Bulk Upload Successful",
		"count":   len(books),
		// How many rows matched a book already in the shared catalog rather
		// than creating a new record.
		"matched_existing": matched,
	})
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
		Preload("BookCopy.Book.Genre").Preload("BookCopy.Book.CatalogEdition.Work.Genre").
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

	// A student can't hold the same title on two active loans.
	if studentHasActiveLoanForBook(req.StudentID, copy.BookID) {
		return c.Status(400).JSON(fiber.Map{"error": "Student already has this book on loan", "code": "DUPLICATE"})
	}

	// This copy may be the one being kept for somebody. Handing it to a
	// different student at the desk would quietly take their place in the queue
	// — the copy status alone does not say so, because a PENDING hold leaves it
	// AVAILABLE. Fulfilling the holder's own reservation is exactly what the
	// desk is for, so only a hold belonging to someone else is refused.
	if held, ok := copyActiveReservation(copy.ID); ok && held.StudentID != req.StudentID {
		return c.Status(400).JSON(fiber.Map{
			"error":     "This copy is being held for " + held.Student.Name,
			"code":      "HELD_FOR_OTHER",
			"held_for":  held.Student.Name,
			"hold_kind": holdKind(held),
		})
	}
	// This direct loan may be fulfilling the student's own reservation for the same
	// book; that reservation already counts toward the limit, so don't double-count.
	resForBook, hasRes := studentActiveReservationForBook(req.StudentID, copy.BookID)
	holdCount := studentHoldCount(req.StudentID)
	if hasRes {
		holdCount--
	}
	if limit := studentEffectiveLimit(req.StudentID); holdCount >= int64(limit) {
		return c.Status(400).JSON(fiber.Map{"error": "Borrow limit reached", "code": "LIMIT", "limit": limit})
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

	// If this loan fulfilled an open reservation for the same book, close it out.
	if hasRes {
		var completed models.ReservationStatus
		tx.Where("code = 'COMPLETED' AND branch_id = ?", branchID).First(&completed)
		tx.Model(&models.Reservation{}).Where("id = ?", resForBook.ID).Update("status_id", completed.ID)
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

	// The route is /return/:id, but the original handler ignored the path
	// parameter and required {book_id, tracking_number} in the body — so the
	// obvious call, POST /return/<loanId> with no body, failed with 400 and
	// check-in appeared broken. Both forms now work:
	//
	//	POST /return/42                              -> 42 is the loan id
	//	POST /return/x  {book_id, tracking_number}   -> the original form
	type ReturnReq struct {
		BookID         uint   `json:"book_id"`
		TrackingNumber string `json:"tracking_number"`
		// ConditionID records what shape the copy came back in, which is the
		// condition row the desk picked. Optional: a return must never fail
		// because of it.
		ConditionID uint `json:"condition_id"`
	}
	var req ReturnReq
	_ = c.BodyParser(&req) // an empty body is fine; the path is then used

	var copy models.BookCopy

	if req.BookID != 0 && req.TrackingNumber != "" {
		if err := database.DB.Preload("Book").
			Where("book_id = ? AND tracking_number = ?", req.BookID, req.TrackingNumber).
			First(&copy).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Copy not found by BookID and Tracking Number"})
		}
	} else {
		loanID, convErr := strconv.Atoi(c.Params("id"))
		if convErr != nil || loanID <= 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "Provide a loan id in the path, or book_id and tracking_number in the body",
			})
		}
		var byID models.Loan
		if err := database.DB.Where("id = ? AND return_date IS NULL", loanID).First(&byID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "No active loan with that id"})
		}
		if err := database.DB.Preload("Book").First(&copy, byID.BookCopyID).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Copy not found"})
		}
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

	updates := map[string]any{"status_id": availableCopyStatus.ID}
	if req.ConditionID != 0 {
		// Only a condition belonging to this branch, so a crafted id cannot
		// point a copy at another library's row.
		var cond models.CopyCondition
		if err := tx.Where("id = ? AND branch_id = ?", req.ConditionID, branchID).
			First(&cond).Error; err == nil {
			updates["condition_id"] = cond.ID
		}
	}
	tx.Model(&models.BookCopy{}).Where("id = ?", copy.ID).Updates(updates)
	tx.Commit()

	return c.JSON(fiber.Map{"message": "Book returned successfully", "student_id": loan.StudentID})
}

// --- STUDENT & LIBRARY STATS ---

func GetStudentStats(c *fiber.Ctx) error {
	studentID := c.Params("id")

	// Reading statistics are personal data; scope them the same way as the
	// library and the diary.
	if err := requireStudentAccess(c, studentID); err != nil {
		return err
	}

	var loans []models.Loan
	database.DB.Preload("BookCopy.Book.Genre").Preload("BookCopy.Book.CatalogEdition.Work.Genre").Where("student_id = ?", studentID).Find(&loans)

	totalRead := len(loans)
	genreCounts := make(map[string]int)
	var favGenre string
	maxCount := 0

	for _, loan := range loans {
		if g := bookGenreName(loan.BookCopy.Book); g != "" {
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

	// The staff Members panel lists what each reader has out by title, so the
	// loan's copy and book come along rather than one query per row.
	query.Preload("Loans").Preload("Loans.Status").
		Preload("Loans.BookCopy").Preload("Loans.BookCopy.Book").
		Find(&students)
	return c.JSON(students)
}

func GetMyLibrary(c *fiber.Ctx) error {
	studentID := c.Params("id")

	// Without this, any signed-in student could read any other student's
	// borrowed books, due dates and reading progress by changing the id in the
	// URL. Same rule as the reading diary: yourself, a librarian in your
	// branch, a manager in your school, or an admin.
	if err := requireStudentAccess(c, studentID); err != nil {
		return err
	}

	var loans []models.Loan
	if err := database.DB.
		Preload("BookCopy").
		Preload("BookCopy.Book").
		Preload("BookCopy.Book.Author").
		Preload("BookCopy.Book.Genre").Preload("BookCopy.Book.CatalogEdition.Work.Genre").
		Preload("Status").
		Where("student_id = ?", studentID).
		Find(&loans).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not fetch loans"})
	}

	type LoanDTO struct {
		ID          uint       `json:"id"`
		BookTitle   string     `json:"book_title"`
		Author      string     `json:"author"`
		Genre       string     `json:"genre"`
		PageCount   int        `json:"page_count"`
		CurrentPage int        `json:"current_page"` // furthest page logged in the reading diary
		IssueDate   time.Time  `json:"issue_date"`
		DueDate     time.Time  `json:"due_date"`
		ReturnDate  *time.Time `json:"return_date"`
		Status      string     `json:"status"`      // Display name, librarian-editable
		StatusCode  string     `json:"status_code"` // Fixed code the UI can branch on
	}

	// Furthest logged page per loan, for progress bars.
	progress := map[uint]int{}
	loanIDs := make([]uint, 0, len(loans))
	for _, l := range loans {
		loanIDs = append(loanIDs, l.ID)
	}
	if len(loanIDs) > 0 {
		type row struct {
			LoanID  uint
			MaxPage int
		}
		var rows []row
		database.DB.Model(&models.ReadingLog{}).
			Select("loan_id, MAX(page) as max_page").
			Where("loan_id IN ?", loanIDs).
			Group("loan_id").
			Scan(&rows)
		for _, r := range rows {
			progress[r.LoanID] = r.MaxPage
		}
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
			genre = bookGenreName(l.BookCopy.Book)
		}

		statusName := "Unknown"
		statusCode := ""
		if l.StatusID != nil {
			statusName = l.Status.Name
			statusCode = l.Status.Code
		}

		current := progress[l.ID]
		if pages > 0 && current > pages {
			current = pages
		}

		response = append(response, LoanDTO{
			ID:          l.ID,
			BookTitle:   title,
			Author:      author,
			Genre:       genre,
			PageCount:   pages,
			CurrentPage: current,
			IssueDate:   l.IssueDate,
			DueDate:     l.DueDate,
			ReturnDate:  l.ReturnDate,
			Status:      statusName,
			StatusCode:  statusCode,
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

	// Expire any approved reservations past their pickup deadline before listing.
	sweepExpiredReservations(branchID)

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
		Preload("BookCopy.Book.Genre").Preload("BookCopy.Book.CatalogEdition.Work.Genre").
		Find(&reservations).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not fetch reservations"})
	}
	return c.JSON(reservations)
}

func RequestReservation(c *fiber.Ctx) error {
	type Req struct {
		StudentID   uint   `json:"student_id"`
		BookID      uint   `json:"book_id"`
		PickupDays  int    `json:"pickup_days"` // student's chosen pickup window (days)
		Description string `json:"description"`
	}

	var r Req
	if err := c.BodyParser(&r); err != nil {
		return c.SendStatus(400)
	}

	// Whose reservation this is comes from the session, not the request body.
	// Taking it from the body let any student reserve on another student's
	// behalf, and let a caller who omitted it create an orphan row with
	// student_id 0 that belonged to nobody and showed up on no one's screen.
	// Staff may still reserve for a student at the desk, but only for one they
	// are allowed to see.
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	role, _ := c.Locals("role").(string)
	isStaff := role == "librarian" || role == "manager" || role == "admin"

	if !isStaff || r.StudentID == 0 {
		r.StudentID = uid
	} else if r.StudentID != uid {
		ok, err := canAccessStudent(c, r.StudentID)
		if err != nil || !ok {
			return c.Status(403).JSON(fiber.Map{"error": "Not allowed to reserve for this student"})
		}
	}

	var student models.Student
	if err := database.DB.Where("user_id = ?", r.StudentID).First(&student).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Only a student can hold a reservation", "code": "NOT_STUDENT"})
	}

	var book models.Book
	if err := database.DB.First(&book, r.BookID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Book not found"})
	}

	// One active hold per title: a student can't reserve a book they already have
	// reserved or on loan.
	if studentHasActiveLoanForBook(r.StudentID, r.BookID) {
		return c.Status(400).JSON(fiber.Map{"error": "You already have this book on loan", "code": "DUPLICATE"})
	}
	if _, exists := studentActiveReservationForBook(r.StudentID, r.BookID); exists {
		return c.Status(400).JSON(fiber.Map{"error": "You already reserved this book", "code": "DUPLICATE"})
	}
	// Respect the borrow limit (active loans + open reservations).
	if limit := studentEffectiveLimit(r.StudentID); studentHoldCount(r.StudentID) >= int64(limit) {
		return c.Status(400).JSON(fiber.Map{"error": "Borrow limit reached", "code": "LIMIT", "limit": limit})
	}

	// Pick a genuinely free copy: AVAILABLE and not already tied up by another
	// student's active reservation. This is what stops N students holding M<N copies.
	var copies []models.BookCopy
	database.DB.Preload("Status").Where("book_id = ?", r.BookID).Find(&copies)
	var chosen *models.BookCopy
	for i := range copies {
		if copies[i].Status.Code == "AVAILABLE" && !copyHasActiveReservation(copies[i].ID) {
			chosen = &copies[i]
			break
		}
	}
	if chosen == nil {
		return c.Status(400).JSON(fiber.Map{"error": "No free copy available to reserve", "code": "NO_COPY"})
	}

	// Clamp the student's requested pickup window to the branch maximum.
	var branch models.Branch
	database.DB.First(&branch, book.BranchID)
	maxDays := branch.MaxPickupDays
	if maxDays < 1 {
		maxDays = 7
	}
	days := r.PickupDays
	if days < 1 {
		days = maxDays
	}
	if days > maxDays {
		days = maxDays
	}

	var pendingStatus models.ReservationStatus
	database.DB.Where("code = 'PENDING' AND branch_id = ?", book.BranchID).First(&pendingStatus)

	reservation := models.Reservation{
		StudentID:   r.StudentID,
		BookCopyID:  chosen.ID,
		RequestDate: time.Now(),
		PickupDays:  days,
		StatusID:    &pendingStatus.ID,
		Description: r.Description,
	}

	// A failed insert used to be swallowed, so the caller got 200 and an empty
	// reservation. Report it.
	if err := database.DB.Create(&reservation).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the reservation"})
	}
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
		// Start the pickup countdown now: the student has PickupDays to collect
		// it. Where they chose nothing, fall back to the branch's own window
		// rather than a hardcoded week — that setting is a librarian's to make
		// (Kitabxana ayarları → Borc qaydaları), so it has to be what applies.
		days := res.PickupDays
		if days < 1 {
			var br models.Branch
			if database.DB.First(&br, branchID).Error == nil && br.MaxPickupDays > 0 {
				days = br.MaxPickupDays
			} else {
				days = 7
			}
		}
		deadline := time.Now().AddDate(0, 0, days)
		res.PickupDeadline = &deadline
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
