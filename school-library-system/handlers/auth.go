package handlers

import (
	"school-library-system/config"
	"school-library-system/database"
	"school-library-system/models"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// SecretKey is sourced from JWT_SECRET (see config package), not hardcoded.
var SecretKey = config.JWTSecret

// --- REGISTER ---
type RegisterInput struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	BranchID   uint   `json:"branch_id"`
	Token      string `json:"token"` // registration token; resolves the branch for students
	Grade      int    `json:"grade"`
	ClassGroup string `json:"classGroup"`
	BirthDate  string `json:"birthDate"`
}

// --- REGISTER ---
func Register(c *fiber.Ctx) error {
	var input RegisterInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	if input.Role == "" {
		input.Role = "student"
	}

	// Students register via a token (invite link), which resolves their branch.
	if input.Role == "student" && input.Token != "" {
		branchID, err := resolveRegistrationToken(input.Token)
		if err != nil {
			if fe, ok := err.(*fiber.Error); ok {
				return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
			}
			return c.Status(400).JSON(fiber.Map{"error": "Invalid registration token"})
		}
		input.BranchID = branchID
	} else if input.Role == "student" && input.BranchID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "A registration link or token is required"})
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(input.Password), 14)
	tx := database.DB.Begin()

	user := models.User{
		Email:    input.Email,
		Password: hashedPwd,
		Role:     input.Role,
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Email exists"})
	}

	switch input.Role {
	case "student":
		bdate, _ := time.Parse("2006-01-02", input.BirthDate)

		if bdate.IsZero() {
			bdate = time.Now()
		}

		student := models.Student{
			UserID:     user.ID,
			Name:       input.Name,
			BranchID:   input.BranchID,
			Grade:      input.Grade,
			ClassGroup: input.ClassGroup,
			BirthDate:  bdate,
		}
		if err := tx.Create(&student).Error; err != nil {
			tx.Rollback()
			return c.Status(500).JSON(fiber.Map{"error": "Could not create student profile"})
		}
	case "librarian":
		lib := models.Librarian{UserID: user.ID, Name: input.Name, BranchID: input.BranchID}
		tx.Create(&lib)
	}

	tx.Commit()
	return c.JSON(user)
}

// --- LOGIN ---
func Login(c *fiber.Ctx) error {
	var data map[string]string
	if err := c.BodyParser(&data); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var user models.User

	if err := database.DB.Where("email = ?", data["email"]).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "User not found"})
	}

	switch user.Role {
	case "librarian":
		database.DB.Preload("Librarian.School").Preload("Librarian.Branch").First(&user, user.ID)
	case "manager":
		database.DB.Preload("Manager.School").First(&user, user.ID)
	case "student":
		database.DB.Preload("Student.Branch").First(&user, user.ID)
	}

	if err := bcrypt.CompareHashAndPassword(user.Password, []byte(data["password"])); err != nil {
		return c.Status(400).JSON(fiber.Map{"message": "Incorrect password"})
	}

	claims := jwt.MapClaims{
		"iss":     user.ID,
		"role":    user.Role,
		"user_id": user.ID,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	t, err := token.SignedString([]byte(SecretKey))
	if err != nil {
		return c.SendStatus(fiber.StatusInternalServerError)
	}

	return c.JSON(fiber.Map{
		"message": "success",
		"token":   t,
		"role":    user.Role,
		"user":    user,
	})
}

func User(c *fiber.Ctx) error {
	id := c.Locals("user_id")
	var user models.User

	if err := database.DB.First(&user, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"message": "User not found"})
	}

	if user.Role == "librarian" {
		database.DB.Preload("Librarian.School").Preload("Librarian.Branch").First(&user, id)
	} else if user.Role == "manager" {
		database.DB.Preload("Manager.School").First(&user, id)
	} else if user.Role == "student" {
		database.DB.Preload("Student.Branch").First(&user, id)
	}

	return c.JSON(user)
}

func Logout(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "success"})
}

// UpdateProfile lets the logged-in user edit their own name, email and password.
// The current password is always required to authorize any change.
func UpdateProfile(c *fiber.Ctx) error {
	claimsID := c.Locals("user_id")
	if claimsID == nil {
		return c.Status(401).JSON(fiber.Map{"message": "Unauthenticated"})
	}
	var userID uint
	if v, ok := claimsID.(float64); ok {
		userID = uint(v)
	} else if v, ok := claimsID.(int); ok {
		userID = uint(v)
	}

	type Req struct {
		Name            string `json:"name"`
		Email           string `json:"email"`
		NewPassword     string `json:"new_password"`
		CurrentPassword string `json:"current_password"`
	}
	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Require the current password before allowing any change.
	if err := bcrypt.CompareHashAndPassword(user.Password, []byte(req.CurrentPassword)); err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Current password is incorrect"})
	}

	if req.Email != "" && req.Email != user.Email {
		var count int64
		database.DB.Model(&models.User{}).Where("email = ? AND id <> ?", req.Email, user.ID).Count(&count)
		if count > 0 {
			return c.Status(400).JSON(fiber.Map{"error": "This email is already in use"})
		}
		user.Email = req.Email
	}
	if req.NewPassword != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 14)
		user.Password = hash
	}
	database.DB.Save(&user)

	// Name lives on the role profile (admins have no name row, so it's a no-op there).
	if req.Name != "" {
		switch user.Role {
		case "librarian":
			database.DB.Model(&models.Librarian{}).Where("user_id = ?", user.ID).Update("name", req.Name)
		case "manager":
			database.DB.Model(&models.Manager{}).Where("user_id = ?", user.ID).Update("name", req.Name)
		case "student":
			database.DB.Model(&models.Student{}).Where("user_id = ?", user.ID).Update("name", req.Name)
		}
	}

	return c.JSON(fiber.Map{"message": "Profile updated"})
}
