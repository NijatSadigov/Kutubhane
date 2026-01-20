package handlers

import (
	"school-library-system/database"
	"school-library-system/models"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// --- SCHOOL MANAGEMENT ---

func CreateSchool(c *fiber.Ctx) error {
	type SchoolReq struct {
		Name    string `json:"name"`
		Address string `json:"address"`
	}

	var req SchoolReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	school := models.School{
		Name:    req.Name,
		Address: req.Address,
	}

	if err := database.DB.Create(&school).Error; err != nil {
		return c.Status(500).SendString("Could not create school")
	}

	return c.JSON(school)
}

// Get School with its Branches
func GetSchoolDetails(c *fiber.Ctx) error {
	id := c.Params("id")
	var school models.School
	if err := database.DB.Preload("Branches").First(&school, id).Error; err != nil {
		return c.SendStatus(404)
	}
	return c.JSON(school)
}

// --- BRANCH MANAGEMENT ---

func CreateBranch(c *fiber.Ctx) error {
	var branch models.Branch
	if err := c.BodyParser(&branch); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}
	database.DB.Create(&branch)
	return c.JSON(branch)
}

func UpdateBranch(c *fiber.Ctx) error {
	id := c.Params("id")
	var branch models.Branch
	if err := database.DB.First(&branch, id).Error; err != nil {
		return c.SendStatus(404)
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

// --- LIBRARIAN MANAGEMENT (Updated for BranchID) ---

func AddLibrarian(c *fiber.Ctx) error {
	type LibReq struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		SchoolID uint   `json:"school_id"`
		BranchID uint   `json:"branch_id"`
	}
	var req LibReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
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
		SchoolID: req.SchoolID,
		BranchID: req.BranchID,
	}
	if err := tx.Create(&lib).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Profile Error"})
	}
	tx.Commit()
	return c.JSON(user)
}

func RemoveLibrarian(c *fiber.Ctx) error {
	idParam := c.Params("id")

	if _, err := strconv.Atoi(idParam); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	var lib models.Librarian
	if err := database.DB.Where("user_id = ?", idParam).First(&lib).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Librarian not found"})
	}

	if lib.UserID != 0 {
		database.DB.Unscoped().Delete(&models.User{}, lib.UserID)
	}

	database.DB.Unscoped().Delete(&lib)

	return c.JSON(fiber.Map{"message": "Librarian deleted successfully"})
}

// 1. Edit Librarian (Move to new Branch/School or Rename)
func UpdateLibrarian(c *fiber.Ctx) error {
	idParam := c.Params("id")

	if _, err := strconv.Atoi(idParam); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	type UpdateLibReq struct {
		Name     string `json:"name"`
		BranchID uint   `json:"branch_id"`
		SchoolID uint   `json:"school_id"`
	}
	var req UpdateLibReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	var lib models.Librarian
	if err := database.DB.First(&lib, idParam).Error; err != nil { // <--- FIXED HERE
		return c.Status(404).JSON(fiber.Map{"error": "Librarian not found"})
	}

	if req.Name != "" {
		lib.Name = req.Name
	}
	if req.BranchID != 0 {
		lib.BranchID = req.BranchID
	}
	if req.SchoolID != 0 {
		lib.SchoolID = req.SchoolID
	}

	database.DB.Save(&lib)
	return c.JSON(lib)
}

// 2. Delete Branch
func DeleteBranch(c *fiber.Ctx) error {
	id := c.Params("id")

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

func DeleteSchool(c *fiber.Ctx) error {
	id := c.Params("id")

	if err := database.DB.Delete(&models.School{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not delete school"})
	}

	return c.JSON(fiber.Map{"message": "School deleted"})
}

func GetAllSchools(c *fiber.Ctx) error {
	var schools []models.School

	if err := database.DB.
		Preload("Branches").
		Preload("Branches.Librarians").
		Preload("Branches.Librarians.User").
		Find(&schools).Error; err != nil {
		return c.Status(500).SendString("Database Error")
	}

	return c.JSON(schools)
}
func UpdateSchool(c *fiber.Ctx) error {
	id := c.Params("id")

	type UpdateReq struct {
		Name    string `json:"name"`
		Address string `json:"address"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}

	var school models.School
	if err := database.DB.First(&school, id).Error; err != nil {
		return c.Status(404).SendString("School not found")
	}

	if req.Name != "" {
		school.Name = req.Name
	}
	if req.Address != "" {
		school.Address = req.Address
	}

	database.DB.Save(&school)
	return c.JSON(school)
}
