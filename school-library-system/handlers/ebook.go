package handlers

import (
	"os"
	"path/filepath"
	"strings"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// Reading an e-book in the browser.
//
// The honest summary of what this protects against, because it is easy to
// oversell: **nothing here stops a determined person keeping a copy.** A web
// page cannot block a screenshot — no browser gives a page that power, and
// anything claiming to is decoration. Somebody with the file open can
// photograph the screen.
//
// What it does do:
//
//   - the PDF is no longer a public URL. It used to sit under /uploads and was
//     one guess away from anybody at all; now the bytes come through here,
//     which checks who is asking and whether the book is theirs;
//   - the reader never receives a file, only pages drawn onto a canvas, so
//     there is no download button and no "save as";
//   - every page carries the reader's own name, which is the part that
//     actually works. A leaked copy says who leaked it, and that changes
//     behaviour in a way a disabled right-click never has.

// canReadEbook reports whether this reader may open this book: they have it out
// on loan, or it is on their shelf as owned. Staff of the branch may open it
// too, because they have to be able to check what they uploaded.
func canReadEbook(uid uint, book models.Book, role string) bool {
	if role == "librarian" || role == "admin" || role == "manager" || role == "teacher" {
		return true
	}

	// Out on loan to them right now.
	var loans int64
	database.DB.Model(&models.Loan{}).
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Where("loans.student_id = ? AND book_copies.book_id = ? AND loans.return_date IS NULL",
			uid, book.ID).Count(&loans)
	if loans > 0 {
		return true
	}

	// Or on their shelf. The shelf is keyed on the Work, so a reader who
	// shelved one edition may read the school's copy of the same book.
	if book.EditionID != nil {
		var ed models.Edition
		if database.DB.First(&ed, *book.EditionID).Error == nil {
			var shelved int64
			database.DB.Model(&models.ShelfItem{}).
				Where("user_id = ? AND work_id = ?", uid, ed.WorkID).Count(&shelved)
			if shelved > 0 {
				return true
			}
		}
	}
	return false
}

// GetEbook streams the file to a reader who is entitled to it.
//
// Inline rather than as an attachment, and with no-store so it does not sit in
// the browser cache as a file afterwards. Neither is a wall; both remove the
// easy ways to end up with a copy without meaning to.
func GetEbook(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	role, _ := c.Locals("role").(string)

	var book models.Book
	if err := database.DB.First(&book, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Book not found"})
	}
	if strings.TrimSpace(book.EBookURL) == "" {
		return c.Status(404).JSON(fiber.Map{"error": "No e-book for this title", "code": "NO_EBOOK"})
	}
	if !canReadEbook(uid, book, role) {
		return c.Status(403).JSON(fiber.Map{
			"error": "Borrow this book or add it to your shelf to read it",
			"code":  "NOT_YOURS"})
	}

	// The stored value is a URL path like /uploads/ebooks/x.pdf. Resolve it
	// under the uploads directory and refuse anything that climbs out of it —
	// the value is written by a librarian, but a path from a database is still
	// a path, and `..` in one should not reach the rest of the disk.
	rel := strings.TrimPrefix(book.EBookURL, "/")
	clean := filepath.Clean(rel)
	if !strings.HasPrefix(clean, filepath.Clean("uploads/ebooks")) {
		return c.Status(400).JSON(fiber.Map{"error": "Bad e-book path"})
	}
	if _, err := os.Stat(clean); err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "The file is missing", "code": "NO_FILE"})
	}

	c.Set("Content-Type", "application/pdf")
	c.Set("Content-Disposition", `inline; filename="reading"`)
	c.Set("Cache-Control", "no-store, private")
	c.Set("X-Content-Type-Options", "nosniff")
	return c.SendFile(clean)
}

// EbookInfo is what the reading screen needs before it opens anything: whether
// there is an e-book, whether this reader may open it, and the name to stamp
// across every page.
func GetEbookInfo(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	role, _ := c.Locals("role").(string)

	var book models.Book
	if err := database.DB.Preload("CatalogEdition.Work").First(&book, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Book not found"})
	}

	title := book.Title
	if book.CatalogEdition != nil && book.CatalogEdition.Title != "" {
		title = book.CatalogEdition.Title
	}

	// The watermark. A name is the deterrent that works, so it is not optional
	// and not something the page decides for itself.
	mark := ""
	var stu models.Student
	if database.DB.Where("user_id = ?", uid).First(&stu).Error == nil {
		mark = stu.Name
	} else {
		var u models.User
		if database.DB.First(&u, uid).Error == nil {
			mark = u.Email
		}
	}

	return c.JSON(fiber.Map{
		"book_id":   book.ID,
		"title":     title,
		"has_ebook": strings.TrimSpace(book.EBookURL) != "",
		"allowed":   strings.TrimSpace(book.EBookURL) != "" && canReadEbook(uid, book, role),
		"watermark": mark,
	})
}
