package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// generateToken returns a complex, unguessable token like "reg_<32 hex chars>".
func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "reg_" + hex.EncodeToString(b)
}

// CreateRegistrationToken (librarian) mints a token for the librarian's branch.
func CreateRegistrationToken(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	type Req struct {
		Label   string `json:"label"`
		Days    int    `json:"days"`     // validity in days (used if expires_at empty)
		Expires string `json:"expires_at"` // optional explicit YYYY-MM-DD
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	expires := time.Now().AddDate(0, 0, 30) // default 30 days
	if req.Expires != "" {
		if t, err := time.Parse("2006-01-02", req.Expires); err == nil {
			// expire at end of the chosen day
			expires = t.Add(24*time.Hour - time.Second)
		}
	} else if req.Days > 0 {
		expires = time.Now().AddDate(0, 0, req.Days)
	}

	tok := models.RegistrationToken{
		BranchID:  branchID,
		Token:     generateToken(),
		Label:     req.Label,
		ExpiresAt: expires,
	}
	if err := database.DB.Create(&tok).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create token"})
	}
	return c.JSON(tok)
}

// GetRegistrationTokens (librarian) lists the branch's tokens, newest first.
func GetRegistrationTokens(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	var tokens []models.RegistrationToken
	database.DB.Where("branch_id = ?", branchID).Order("created_at DESC").Find(&tokens)
	return c.JSON(tokens)
}

// DeleteRegistrationToken (librarian) revokes/removes a token from the branch.
func DeleteRegistrationToken(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	id := c.Params("id")
	res := database.DB.Where("id = ? AND branch_id = ?", id, branchID).Delete(&models.RegistrationToken{})
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Token not found"})
	}
	return c.JSON(fiber.Map{"message": "Token deleted"})
}

// ValidateRegistrationToken (public) reports whether a token is usable and, if
// so, which library it belongs to — so the register page can show it.
func ValidateRegistrationToken(c *fiber.Ctx) error {
	token := c.Params("token")
	var tok models.RegistrationToken
	if err := database.DB.Preload("Branch").Where("token = ?", token).First(&tok).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"valid": false, "error": "Invalid token"})
	}
	if tok.Revoked {
		return c.Status(400).JSON(fiber.Map{"valid": false, "error": "Token revoked"})
	}
	if time.Now().After(tok.ExpiresAt) {
		return c.Status(400).JSON(fiber.Map{"valid": false, "error": "Token expired"})
	}
	return c.JSON(fiber.Map{"valid": true, "branch_id": tok.BranchID, "branch_name": tok.Branch.Name})
}

// resolveRegistrationToken validates a token and returns its branch id. Shared
// by the Register handler.
func resolveRegistrationToken(token string) (uint, error) {
	var tok models.RegistrationToken
	if err := database.DB.Where("token = ?", token).First(&tok).Error; err != nil {
		return 0, fiber.NewError(400, "Invalid registration token")
	}
	if tok.Revoked {
		return 0, fiber.NewError(400, "This registration link has been revoked")
	}
	if time.Now().After(tok.ExpiresAt) {
		return 0, fiber.NewError(400, "This registration link has expired")
	}
	database.DB.Model(&models.RegistrationToken{}).Where("id = ?", tok.ID).UpdateColumn("use_count", tok.UseCount+1)
	return tok.BranchID, nil
}
