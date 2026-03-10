package handlers

import (
	"school-library-system/database"
	"school-library-system/models"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

const SecretKey = "secret"

// --- REGISTER ---
type RegisterInput struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	Name       string `json:"name"`
	Role       string `json:"role"`
	BranchID   uint   `json:"branch_id"`
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
	} else if user.Role == "student" {
		database.DB.Preload("Student.Branch").First(&user, id)
	}

	return c.JSON(user)
}

func Logout(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{"message": "success"})
}
func DebugLibrarians(c *fiber.Ctx) error {
	var libs []models.Librarian
	database.DB.Preload("School").Preload("Branch").Find(&libs)
	return c.JSON(libs)
}
