package handlers

import (
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// --- STUDENT ---

// CreateBookRequest lets a student ask for a book the branch doesn't stock. The
// branch is taken from the student's own profile, never the request body.
func CreateBookRequest(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}

	type Req struct {
		Title  string `json:"title"`
		Author string `json:"author"`
		Note   string `json:"note"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Title is required"})
	}

	br := models.BookRequest{
		StudentID: uid,
		BranchID:  branchID,
		Title:     req.Title,
		Author:    req.Author,
		Note:      req.Note,
		Status:    "PENDING",
	}
	if err := database.DB.Create(&br).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create request"})
	}
	return c.JSON(br)
}

// GetMyBookRequests returns the authenticated student's own requests.
func GetMyBookRequests(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	var reqs []models.BookRequest
	database.DB.Where("student_id = ?", uid).Order("created_at desc").Find(&reqs)
	return c.JSON(reqs)
}

// --- LIBRARIAN (branch-scoped) ---

// GetBranchBookRequests returns every request for the librarian's branch.
func GetBranchBookRequests(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}
	var reqs []models.BookRequest
	database.DB.
		Preload("Student").
		Where("branch_id = ?", branchID).
		Order("created_at desc").
		Find(&reqs)
	return c.JSON(reqs)
}

// UpdateBookRequestStatus sets a request to FULFILLED or REJECTED. The librarian
// may only touch requests in their own branch.
func UpdateBookRequestStatus(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}
	id := c.Params("id")

	type Req struct {
		Status string `json:"status"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Status != "FULFILLED" && req.Status != "REJECTED" && req.Status != "PENDING" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
	}

	var br models.BookRequest
	if err := database.DB.First(&br, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Request not found"})
	}
	if br.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "This request belongs to another branch"})
	}

	br.Status = req.Status
	database.DB.Save(&br)
	return c.JSON(br)
}

// --- MANAGER (school-scoped) ---

// GetSchoolBookRequests returns every request across the manager's school.
func GetSchoolBookRequests(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}
	var reqs []models.BookRequest
	database.DB.
		Preload("Student").
		Preload("Branch").
		Joins("JOIN branches ON branches.id = book_requests.branch_id").
		Where("branches.school_id = ?", schoolID).
		Order("book_requests.created_at desc").
		Find(&reqs)
	return c.JSON(reqs)
}

// ManagerUpdateBookRequestStatus lets a manager fulfill/reject any request in their
// school.
func ManagerUpdateBookRequestStatus(c *fiber.Ctx) error {
	schoolID, err := resolveManagerSchoolID(c)
	if err != nil {
		return err
	}
	id := c.Params("id")

	type Req struct {
		Status string `json:"status"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Status != "FULFILLED" && req.Status != "REJECTED" && req.Status != "PENDING" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
	}

	var br models.BookRequest
	if err := database.DB.First(&br, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Request not found"})
	}
	if !branchInSchool(br.BranchID, schoolID) {
		return c.Status(403).JSON(fiber.Map{"error": "This request belongs to another school"})
	}

	br.Status = req.Status
	database.DB.Save(&br)
	return c.JSON(br)
}
