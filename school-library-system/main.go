package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"school-library-system/config"
	"school-library-system/database"
	"school-library-system/models"
	"school-library-system/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/recover"
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
		&models.QuizSession{},
		&models.Review{},
		&models.ReviewVote{},
		&models.ReviewReply{},
		&models.ReviewReport{},
		&models.Ticket{},
		&models.TicketReply{},
		&models.Teacher{},
		&models.AcademicYear{},
		&models.Subject{},
		&models.Classroom{},
		&models.Textbook{},
		&models.TextbookRequest{},
		&models.TextbookRequestLine{},
		&models.TextbookMovement{},
		&models.Notification{},
		&models.Project{},
		&models.ProjectUpdate{},
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
	// Rename any status labels still seeded in Turkish. Idempotent, and it
	// leaves alone anything a librarian has renamed themselves.
	database.LocaliseStatusNames()

	// Seed the badge definitions the design specifies. Idempotent.
	database.SeedBadges()

	// 3. Ensure upload directories exist
	os.MkdirAll("uploads/covers", 0o755)
	os.MkdirAll("uploads/ebooks", 0o755)

	// 4. Setup App — larger body limit so book cover images and e-book PDFs fit.
	app := fiber.New(fiber.Config{
		BodyLimit: 30 * 1024 * 1024, // 30 MB
		// Behind Caddy or nginx every request arrives from 127.0.0.1, so
		// c.IP() — which the rate limiter keys on — would see one client.
		// Reading X-Forwarded-For is only safe when something in front is
		// actually setting it; otherwise any client can claim any address.
		// Hence the switch rather than a default. See .env.example.
		ProxyHeader: config.ProxyHeader(),
	})

	// A panic in one handler should cost that one request, not the process.
	// Without this, a nil map or a bad index anywhere in 213 routes takes the
	// library down for the whole school until somebody notices.
	app.Use(recover.New())

	// Who may call this API from a browser. Hardcoding the two dev servers
	// meant the first deployment anywhere else failed at the first request,
	// with a CORS message that says nothing about which origin to add.
	app.Use(cors.New(cors.Config{
		AllowOrigins:     config.CORSOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		AllowMethods:     "GET, POST, HEAD, PUT, DELETE, PATCH",
	}))

	// Serve uploaded covers and e-books statically (public; names are unguessable).
	// Covers are public — they are on the catalogue a guest can browse.
	//
	// E-books are **not** served from here. They used to be, which meant the
	// file was one guessed URL away from anybody at all, signed in or not, and
	// downloadable in a click. They go through GET /api/ebook/:id now, which
	// checks who is asking and whether the book is theirs to read.
	app.Static("/uploads/covers", "./uploads/covers")

	routes.Setup(app)

	// 5. Optionally serve the built UI from this same process.
	//
	// The simplest deployment of this system is one box: Postgres, this
	// binary, and the Vite build it hands out. Same origin means no CORS to
	// configure and no second web server to keep alive, which is two of the
	// three things that go wrong on a first deployment.
	//
	// The UI is a single-page app, so a request for /staff/school/branch is a
	// request for index.html — the router sorts out the rest in the browser.
	// The fallback is registered after routes.Setup, and declines anything
	// under /api or /uploads, so a mistyped endpoint still answers 404 rather
	// than handing a confused client a page of HTML.
	if dir := config.StaticDir; dir != "" {
		if _, err := os.Stat(filepath.Join(dir, "index.html")); err != nil {
			log.Fatalf("[static] STATIC_DIR=%s has no index.html in it (%v). Build the frontend first, or unset STATIC_DIR.", dir, err)
		}
		app.Static("/", dir)
		app.Use(func(c *fiber.Ctx) error {
			p := c.Path()
			if strings.HasPrefix(p, "/api") || strings.HasPrefix(p, "/uploads") {
				return c.Next()
			}
			return c.SendFile(filepath.Join(dir, "index.html"))
		})
		log.Printf("[static] serving the UI from %s", dir)
	}

	// The port is configurable so a second instance can be run against a
	// scratch database for testing without fighting the real one for :8000.
	//
	// It is also what Passenger sets. cPanel's Application Manager picks a
	// port, puts it here, and listens for the app on it — which is why a
	// deployment there must *not* set PORT itself.
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}

	// Which interface. Empty means all of them, which is right on a machine
	// that is yours and convenient in development — the dev server is
	// reachable from a phone on the same network.
	//
	// On shared hosting it is not: every other account on the box can reach a
	// port bound to 0.0.0.0, and the only thing that should be connecting is
	// the proxy in front, over loopback. BIND_ADDRESS=127.0.0.1 there.
	addr := config.BindAddress + ":" + port
	log.Printf("[http] listening on %s", addr)
	log.Fatal(app.Listen(addr))
}
