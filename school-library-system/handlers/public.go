package handlers

import (
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// GetPublicStats returns aggregate, non-identifying reading statistics for the
// public landing page: per-school counts plus platform totals. It is intentionally
// registered OUTSIDE the auth group and exposes no student PII — only counts.
func GetPublicStats(c *fiber.Ctx) error {
	var schools []models.School
	if err := database.DB.Preload("Branches").Order("name asc").Find(&schools).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load schools"})
	}

	type SchoolStat struct {
		ID        uint   `json:"id"`
		Name      string `json:"name"`
		Address   string `json:"address"`
		Branches  int    `json:"branches"`
		Students  int64  `json:"students"`
		Books     int64  `json:"books"`
		BooksRead int64  `json:"books_read"`
		PagesRead int64  `json:"pages_read"`
	}

	out := []SchoolStat{}
	var tStudents, tBooks, tBooksRead, tPages int64
	tBranches := 0

	for _, s := range schools {
		branchIDs := make([]uint, 0, len(s.Branches))
		for _, b := range s.Branches {
			branchIDs = append(branchIDs, b.ID)
		}

		var students, books, booksRead, pages int64
		if len(branchIDs) > 0 {
			database.DB.Model(&models.Student{}).Where("branch_id IN ?", branchIDs).Count(&students)
			database.DB.Model(&models.Book{}).Where("branch_id IN ?", branchIDs).Count(&books)

			readQ := database.DB.Model(&models.Loan{}).
				Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
				Joins("JOIN books ON books.id = book_copies.book_id").
				Where("books.branch_id IN ? AND loans.return_date IS NOT NULL", branchIDs)
			readQ.Count(&booksRead)

			database.DB.Model(&models.Loan{}).
				Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
				Joins("JOIN books ON books.id = book_copies.book_id").
				Where("books.branch_id IN ? AND loans.return_date IS NOT NULL", branchIDs).
				Select("COALESCE(SUM(books.page_count),0)").
				Scan(&pages)
		}

		out = append(out, SchoolStat{
			ID: s.ID, Name: s.Name, Address: s.Address,
			Branches: len(s.Branches), Students: students, Books: books,
			BooksRead: booksRead, PagesRead: pages,
		})

		tBranches += len(s.Branches)
		tStudents += students
		tBooks += books
		tBooksRead += booksRead
		tPages += pages
	}

	return c.JSON(fiber.Map{
		"totals": fiber.Map{
			"schools":    len(schools),
			"branches":   tBranches,
			"students":   tStudents,
			"books":      tBooks,
			"books_read": tBooksRead,
			"pages_read": tPages,
		},
		"schools": out,
	})
}
