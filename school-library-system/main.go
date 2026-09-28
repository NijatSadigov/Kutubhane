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
		&models.CatalogAuthor{},
		&models.CatalogPublisher{},
		&models.CatalogGenre{},
		&models.CatalogTopic{},
		&models.Work{},
		&models.Edition{},
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
		&models.ShelfItem{},
		&models.Note{},
		&models.ReadingGoal{},
		&models.Badge{},
		&models.UserBadge{},
		&models.Challenge{},
		&models.ChallengeBook{},
		&models.ChallengeParticipant{},
		&models.ChallengeProgress{},
		&models.QuizQuestion{},
		&models.QuizAttempt{},
		&models.Review{},
		&models.ReviewVote{},
		&models.ReviewReply{},
		&models.ReviewReport{},
		&models.Ticket{},
		&models.TicketReply{},
	)
	// 2b. Catalog integrity constraints that AutoMigrate cannot express.
	//
	// The resolver checks for an existing edition before creating one, but a
	// check-then-insert is not atomic: two librarians adding the same ISBN at
	// the same moment would both pass the check. These partial unique indexes
	// make the database the final arbiter. They are partial because blank
	// identifiers are common and must stay allowed, and because an edition
	// merged into another keeps its identifier.
	for _, stmt := range []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS uniq_editions_isbn13
		   ON editions (isbn13) WHERE isbn13 <> '' AND merged_into_id IS NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uniq_works_match_key
		   ON works (match_key) WHERE merged_into_id IS NULL`,
	} {
		if err := database.DB.Exec(stmt).Error; err != nil {
			// Not fatal: an existing database may hold duplicates that must be
			// merged first. Log loudly so it is not missed.
			log.Printf("[catalog] WARNING: could not create index (%v). Duplicates may already exist — run the merge tool.", err)
		}
	}

	// 2c. Genre and topic belong to the Work, not to a branch's own list. Moves
	// any still on a holding; idempotent, so it is safe on every boot.
	database.BackfillWorkGenres()

	// 3. Seed Default Statuses for Each Branch
	var branches []models.Branch
	database.DB.Find(&branches)
	for _, branch := range branches {
		database.SeedDefaultStatusesForBranch(branch.ID)
		database.EnsureExpiredReservationStatus(branch.ID) // backfill for older branches
	}
	// Seed the badge definitions the design specifies. Idempotent.
	database.SeedBadges()

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

	// The port is configurable so a second instance can be run against a
	// scratch database for testing without fighting the real one for :8000.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	log.Fatal(app.Listen(":" + port))
}
