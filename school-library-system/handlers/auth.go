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
//
// What a reader may say about themselves when joining. Deliberately missing:
// `role` and `branch_id`. Both used to be here and both were taken at face
// value, which meant an unauthenticated POST of
//
//	{"email":"...","password":"...","role":"admin"}
//
// returned a working platform-admin account — every school on the
// installation, readable, editable and deletable, including deleting one
// outright. There is no sign-up for staff: a librarian or an administrator is
// created by someone who already is one, through /admin/* or /manager/*.
//
// The branch is the invite link's, never the client's, for the same reason the
// class is: the link is the thing the school controls.
type RegisterInput struct {
	Email      string `json:"email"`
	Password   string `json:"password"`
	Name       string `json:"name"`
	Token      string `json:"token"` // registration token; resolves the branch
	Grade      int    `json:"grade"`
	ClassGroup string `json:"classGroup"`
	BirthDate  string `json:"birthDate"`
}

// Register creates a reader, and only a reader, from a branch's invite link.
func Register(c *fiber.Ctx) error {
	var input RegisterInput
	if err := c.BodyParser(&input); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	// No token, no account. A branch id in the body used to be accepted as an
	// alternative, which let anybody join any branch of any school without an
	// invitation — the link is what makes a reader somebody the school asked
	// for.
	tok, err := resolveRegistrationToken(input.Token)
	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return c.Status(400).JSON(fiber.Map{"error": "Invalid registration token"})
	}

	// The class comes from the link, overriding anything the client sent.
	// A child cannot put themselves in another class by editing the request,
	// and thirty children cannot spell one class three ways. A link with no
	// class leaves the pair as the child typed it, for staff to correct.
	grade, classGroup := input.Grade, input.ClassGroup
	if tok.Grade > 0 {
		grade, classGroup = tok.Grade, tok.ClassGroup
	}

	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte(input.Password), 14)
	tx := database.DB.Begin()

	user := models.User{
		Email:    input.Email,
		Password: hashedPwd,
		Role:     "student",
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Email exists"})
	}

	bdate, _ := time.Parse("2006-01-02", input.BirthDate)
	if bdate.IsZero() {
		bdate = time.Now()
	}

	student := models.Student{
		UserID:     user.ID,
		Name:       input.Name,
		BranchID:   tok.BranchID,
		Grade:      grade,
		ClassGroup: classGroup,
		BirthDate:  bdate,
	}
	if err := tx.Create(&student).Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Could not create student profile"})
	}

	tx.Commit()

	// If the branch runs a dərslik classroom for the class this link names,
	// the new reader joins its roster. Before this they were in the class for
	// every reading feature and on nobody's textbook list — which nobody would
	// notice until the books were handed out and one child had none.
	attachClassroom(&student)

	return c.JSON(user)
}

// dummyHash is a real bcrypt hash at the cost this system uses, compared
// against when no such account exists so that both answers cost the same.
// Of "not-a-password", which nobody will be typing.
var dummyHash = []byte("$2a$14$iR93fi66VMb9wRPNSI.FueVUISrY7AJ.6j0Iz0jC8Ms8DkkBiFhLO")

// badCredentials is the one answer to a sign-in that did not work.
//
// It used to be two: 404 "User not found" for an address nobody has, and 400
// "Incorrect password" for one somebody does. That let anyone ask the server
// whether a given person has an account here — one request per address, with
// no password needed and nothing to brute force. For a system whose accounts
// are children, that is worth not answering.
//
// No English prose either. The old messages were sent straight to the screen
// by the login page, so an Azerbaijani UI said "Incorrect password" in
// English. The code is what the client should key off; the words are its own.
func badCredentials(c *fiber.Ctx) error {
	return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
		"code": "BAD_CREDENTIALS",
	})
}

// --- LOGIN ---
func Login(c *fiber.Ctx) error {
	var data map[string]string
	if err := c.BodyParser(&data); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var user models.User

	if err := database.DB.Where("email = ?", data["email"]).First(&user).Error; err != nil {
		// Spend the same time as a real comparison before answering. Without
		// this, an unknown address returns immediately while a known one costs
		// ~100ms of bcrypt, and the difference says which is which as clearly
		// as the old 404 did.
		bcrypt.CompareHashAndPassword(dummyHash, []byte(data["password"]))
		return badCredentials(c)
	}

	switch user.Role {
	case "librarian":
		database.DB.Preload("Librarian.School").Preload("Librarian.Branch").First(&user, user.ID)
	case "manager":
		database.DB.Preload("Manager.School").First(&user, user.ID)
	case "student":
		database.DB.Preload("Student.Branch").First(&user, user.ID)
	case "teacher":
		database.DB.Preload("Teacher.School").Preload("Teacher.Branch").First(&user, user.ID)
	}

	if err := bcrypt.CompareHashAndPassword(user.Password, []byte(data["password"])); err != nil {
		return badCredentials(c)
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
