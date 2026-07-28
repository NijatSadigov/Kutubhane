package main

import (
	"log"
	"os"
	"school-library-system/database"
	"school-library-system/models"
	"school-library-system/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func main() {
	// 1. Connect DB
	database.Connect()

	// 2. Auto Migrate Models

	database.DB.AutoMigrate(
		&models.School{},
		&models.Branch{},
		&models.User{},
		&models.Librarian{},
		&models.Manager{},
		&models.Student{},
		&models.Publisher{},
		&models.Author{},
		&models.Topic{},
		&models.Genre{},
		&models.Frequency{},
		&models.CopyCondition{},
		&models.CopyStatus{},
		&models.LoanStatus{},
		&models.ReservationStatus{},
		&models.Book{},
		&models.BookCopy{},
		&models.Loan{},
		&models.Reservation{},
		&models.ReadingLog{},
		&models.BookRequest{},
		&models.RegistrationToken{},
	)
	// 3. Seed Default Statuses for Each Branch
	var branches []models.Branch
	database.DB.Find(&branches)
	for _, branch := range branches {
		database.SeedDefaultStatusesForBranch(branch.ID)
	}
	// 3. Ensure upload directories exist
	os.MkdirAll("uploads/covers", 0o755)
	os.MkdirAll("uploads/ebooks", 0o755)

	// 4. Setup App — larger body limit so book cover images and e-book PDFs fit.
	app := fiber.New(fiber.Config{
		BodyLimit: 30 * 1024 * 1024, // 30 MB
	})

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:5180,http://localhost:5173",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))

	// Serve uploaded covers and e-books statically (public; names are unguessable).
	app.Static("/uploads", "./uploads")

	routes.Setup(app)

	log.Fatal(app.Listen(":8000"))
}
