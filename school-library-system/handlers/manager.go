package handlers

import (
	"school-library-system/database"
	"school-library-system/models"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// resolveManagerSchoolID returns the SchoolID of the currently-authenticated
// manager. Every /manager/* handler calls this and confines its work to that
// school — the school is derived from the JWT identity, never from the request
// body, so a manager cannot act on another school's data.
func resolveManagerSchoolID(c *fiber.Ctx) (uint, error) {
	raw := c.Locals("user_id")
	if raw == nil {
		return 0, fiber.NewError(fiber.StatusUnauthorized, "Unauthenticated")
	}

	var userID uint
	switch v := raw.(type) {
	case float64:
		userID = uint(v)
	case int:
		userID = uint(v)
	case uint:
		userID = v
	default:
		return 0, fiber.NewError(fiber.StatusUnauthorized, "Bad identity")
	}

	var mgr models.Manager
	if err := database.DB.Where("user_id = ?", userID).First(&mgr).Error; err != nil {
		// Admins pass the IsManager gate but have no manager profile.
		return 0, fiber.NewError(fiber.StatusForbidden, "Not a school manager")
	}
	return mgr.SchoolID, nil
}

// branchInSchool reports whether a branch id belongs to the given school.
func branchInSchool(branchID uint, schoolID uint) bool {
	if branchID == 0 {
		return false
	}
	var count int64
	database.DB.Model(&models.Branch{}).
		Where("id = ? AND school_id = ?", branchID, schoolID).
		Count(&count)
	return count > 0
}

// --- SCHOOL (own) ---

// GetMySchool returns the manager's own school with its branches and librarians,
// matching the shape of a single element of the admin GetAllSchools response.
func GetMySchool(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	var school models.School
	if err := database.DB.
		Preload("Branches").
		Preload("Branches.Librarians").
		Preload("Branches.Librarians.User").
		First(&school, schoolID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "School not found"})
	}
	return c.JSON(school)
}

// ManagerUpdateSchool lets a manager edit their own school's name/address.
func ManagerUpdateSchool(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	type UpdateReq struct {
		Name    string `json:"name"`
		Address string `json:"address"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	var school models.School
	if err := database.DB.First(&school, schoolID).Error; err != nil {
		return c.Status(404).SendString("School not found")
	}

	if req.Name != "" {
		school.Name = req.Name
	}
	// Address may be cleared intentionally, so only skip when the key is absent
	// is not distinguishable here; treat empty as "leave unchanged" for parity
	// with the admin UpdateSchool handler.
	if req.Address != "" {
		school.Address = req.Address
	}

	database.DB.Save(&school)
	return c.JSON(school)
}

// --- LIBRARIAN TRACKING (per-librarian activity across the school) ---

// ManagerLibrarianStats returns, for every librarian in the manager's school,
// their branch and the activity happening there: catalog size, active loans,
// pending reservations, pending book requests and student count. Lets a manager
// keep an eye on how each branch/librarian is doing.
func ManagerLibrarianStats(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	var libs []models.Librarian
	database.DB.
		Preload("User").
		Preload("Branch").
		Joins("JOIN branches ON branches.id = librarians.branch_id").
		Where("branches.school_id = ?", schoolID).
		Order("librarians.name asc").
		Find(&libs)

	type LibStat struct {
		UserID              uint   `json:"user_id"`
		Name                string `json:"name"`
		Email               string `json:"email"`
		BranchID            uint   `json:"branch_id"`
		BranchName          string `json:"branch_name"`
		Books               int64  `json:"books"`
		Copies              int64  `json:"copies"`
		ActiveLoans         int64  `json:"active_loans"`
		PendingReservations int64  `json:"pending_reservations"`
		PendingRequests     int64  `json:"pending_requests"`
		Students            int64  `json:"students"`
	}

	out := []LibStat{}
	for _, l := range libs {
		b := l.BranchID
		var books, copies, active, pendingRes, pendingReq, students int64

		database.DB.Model(&models.Book{}).Where("branch_id = ?", b).Count(&books)
		database.DB.Model(&models.BookCopy{}).
			Joins("JOIN books ON books.id = book_copies.book_id").
			Where("books.branch_id = ?", b).Count(&copies)
		database.DB.Model(&models.Loan{}).
			Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
			Joins("JOIN books ON books.id = book_copies.book_id").
			Where("books.branch_id = ? AND loans.return_date IS NULL", b).Count(&active)
		database.DB.Model(&models.Reservation{}).
			Joins("JOIN book_copies ON book_copies.id = reservations.book_copy_id").
			Joins("JOIN books ON books.id = book_copies.book_id").
			Joins("JOIN reservation_statuses ON reservation_statuses.id = reservations.status_id").
			Where("books.branch_id = ? AND reservation_statuses.code = 'PENDING'", b).Count(&pendingRes)
		database.DB.Model(&models.BookRequest{}).
			Where("branch_id = ? AND status = 'PENDING'", b).Count(&pendingReq)
		database.DB.Model(&models.Student{}).Where("branch_id = ?", b).Count(&students)

		out = append(out, LibStat{
			UserID: l.UserID, Name: l.Name, Email: l.User.Email,
			BranchID: b, BranchName: l.Branch.Name,
			Books: books, Copies: copies, ActiveLoans: active,
			PendingReservations: pendingRes, PendingRequests: pendingReq, Students: students,
		})
	}
	return c.JSON(out)
}

// --- STUDENTS (read-only, school-wide) ---

// ManagerGetStudents returns every student across the school's branches.
func ManagerGetStudents(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	var students []models.Student
	if err := database.DB.
		Preload("Branch").
		Joins("JOIN branches ON branches.id = students.branch_id").
		Where("branches.school_id = ?", schoolID).
		Order("students.name asc").
		Find(&students).Error; err != nil {
		return c.Status(500).SendString("Database Error")
	}
	return c.JSON(students)
}

// --- BRANCHES ---

func ManagerCreateBranch(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	type BranchReq struct {
		Name string `json:"name"`
	}
	var req BranchReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	// SchoolID is forced from the manager's identity, never the request body.
	branch := models.Branch{Name: req.Name, SchoolID: schoolID}
	if err := database.DB.Create(&branch).Error; err != nil {
		return c.Status(500).SendString("Could not create branch")
	}

	database.SeedDefaultStatusesForBranch(branch.ID)
	return c.JSON(branch)
}

func ManagerUpdateBranch(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	var branch models.Branch
	if err := database.DB.First(&branch, id).Error; err != nil {
		return c.SendStatus(404)
	}
	if branch.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Branch is not in your school"})
	}

	type UpdateReq struct {
		Name string `json:"name"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.SendStatus(400)
	}

	branch.Name = req.Name
	database.DB.Save(&branch)
	return c.JSON(branch)
}

func ManagerDeleteBranch(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	id := c.Params("id")
	var branch models.Branch
	if err := database.DB.First(&branch, id).Error; err != nil {
		return c.SendStatus(404)
	}
	if branch.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Branch is not in your school"})
	}

	tx := database.DB.Begin()
	tx.Model(&models.Student{}).Where("branch_id = ?", id).Update("branch_id", 0)
	tx.Delete(&models.Book{}, "branch_id = ?", id)
	if err := tx.Delete(&models.Branch{}, id).Error; err != nil {
		tx.Rollback()
		return c.Status(500).SendString("Could not delete branch")
	}
	tx.Commit()
	return c.JSON(fiber.Map{"message": "Branch deleted. Students unlinked."})
}

// --- LIBRARIANS ---

func ManagerAddLibrarian(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	type LibReq struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		BranchID uint   `json:"branch_id"`
	}
	var req LibReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	if !branchInSchool(req.BranchID, schoolID) {
		return c.Status(403).JSON(fiber.Map{"error": "Branch is not in your school"})
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 14)
	tx := database.DB.Begin()

	user := models.User{Email: req.Email, Password: hashedPwd, Role: "librarian"}
	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Email exists"})
	}

	lib := models.Librarian{
		UserID:   user.ID,
		Name:     req.Name,
		SchoolID: schoolID,
		BranchID: req.BranchID,
	}
	if err := tx.Create(&lib).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Profile Error"})
	}
	tx.Commit()
	return c.JSON(user)
}

func ManagerUpdateLibrarian(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	idParam := c.Params("id")
	if _, err := strconv.Atoi(idParam); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	type UpdateLibReq struct {
		Name     string `json:"name"`
		BranchID uint   `json:"branch_id"`
	}
	var req UpdateLibReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	var lib models.Librarian
	if err := database.DB.Where("user_id = ?", idParam).First(&lib).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Librarian not found"})
	}
	if lib.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Librarian is not in your school"})
	}

	if req.Name != "" {
		lib.Name = req.Name
	}
	if req.BranchID != 0 {
		if !branchInSchool(req.BranchID, schoolID) {
			return c.Status(403).JSON(fiber.Map{"error": "Branch is not in your school"})
		}
		lib.BranchID = req.BranchID
	}

	database.DB.Save(&lib)
	return c.JSON(lib)
}

func ManagerRemoveLibrarian(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}

	idParam := c.Params("id")
	if _, err := strconv.Atoi(idParam); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	var lib models.Librarian
	if err := database.DB.Where("user_id = ?", idParam).First(&lib).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Librarian not found"})
	}
	if lib.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Librarian is not in your school"})
	}

	if lib.UserID != 0 {
		database.DB.Unscoped().Delete(&models.User{}, lib.UserID)
	}
	database.DB.Unscoped().Delete(&lib)

	return c.JSON(fiber.Map{"message": "Librarian deleted successfully"})
}
