package main

import (
	"log"
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
	)
	// 3. Seed Default Statuses for Each Branch
	var branches []models.Branch
	database.DB.Find(&branches)
	for _, branch := range branches {
		database.SeedDefaultStatusesForBranch(branch.ID)
	}
	// 3. Setup App
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:5180,http://localhost:5173",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))

	routes.Setup(app)

	log.Fatal(app.Listen(":8000"))
}
