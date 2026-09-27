package routes

import (
	"school-library-system/handlers"
	"school-library-system/middleware"

	"github.com/gofiber/fiber/v2"
)

func Setup(app *fiber.App) {

	// ... (Public Routes) ...
	app.Post("/api/register", handlers.Register)
	app.Post("/api/login", handlers.Login)
	app.Get("/api/registration-tokens/validate/:token", handlers.ValidateRegistrationToken)

	// Public aggregate stats for the landing page (no auth, no PII)
	app.Get("/api/public/stats", handlers.GetPublicStats)
	// Books for the logged-out landing page: bibliographic facts and loan
	// counts only, never who borrowed what.
	app.Get("/api/public/books", handlers.GetPublicBooks)

	api := app.Group("/api", middleware.IsAuthenticated)

	// ... (Session Routes) ...
	api.Get("/user", handlers.User)
	api.Post("/logout", handlers.Logout)
	api.Put("/profile", handlers.UpdateProfile)

	// File uploads (covers, e-book PDFs) — librarians only
	api.Post("/upload/:kind", middleware.IsLibrarian, handlers.UploadFile)

	// ===========================
	// GLOBAL CATALOG (shared across every branch and school)
	// ===========================
	// Readable by any signed-in user: editions carry no branch data, and the
	// social layer will read the same records. Writes stay with the resolver
	// behind AddBook, so nobody edits a shared record by hand.
	api.Get("/catalog/search", handlers.SearchCatalog)
	api.Get("/catalog/editions/:id", handlers.GetEdition)
	// Reader-facing catalogue grid (myredbookshelf Catalogue screen).
	api.Get("/catalog/browse", handlers.BrowseCatalogue)

	// Community hub (Discover): all derived from loans and the reading diary.
	api.Get("/community/trending", handlers.GetTrending)
	api.Get("/community/readers", handlers.GetTopReaders)
	api.Get("/community/league", handlers.GetLeague)

	// ===========================
	// MY SHELF (the reader's own profile)
	// ===========================
	api.Get("/shelf", handlers.GetShelf)
	api.Post("/shelf", handlers.SetShelfStatus)
	api.Get("/shelf/summary", handlers.GetShelfSummary)
	api.Get("/shelf/badges", handlers.GetBadges)
	api.Post("/shelf/badges/:id/pin", handlers.PinBadge)
	api.Get("/notes", handlers.GetNotes)
	api.Post("/notes", handlers.SaveNote)
	api.Delete("/notes/:id", handlers.DeleteNote)

	// The reader's own bookings — a student could create a reservation but
	// never see or withdraw one.
	api.Get("/my-reservations", handlers.GetMyReservations)
	api.Delete("/reservation/:id", handlers.CancelMyReservation)

	// ===========================
	// REVIEWS & RATINGS
	// ===========================
	api.Get("/works/:id/reviews", handlers.GetWorkReviews)
	api.Post("/reviews", handlers.CreateReview)
	api.Delete("/reviews/:id", handlers.DeleteReview)
	api.Post("/reviews/:id/vote", handlers.VoteReview)
	api.Post("/reviews/:id/replies", handlers.ReplyToReview)
	api.Post("/reviews/:id/report", handlers.ReportReview)
	api.Get("/community/reviews", handlers.GetRecentReviews)
	api.Get("/community/top-reviewer", handlers.GetTopReviewer)

	// ===========================
	// CHALLENGES
	// ===========================
	api.Get("/challenges", handlers.ListChallenges)
	api.Get("/challenges/:id", handlers.GetChallenge)
	api.Post("/challenges/:id/join", handlers.JoinChallenge)
	api.Post("/challenges/:id/read", handlers.MarkRead)
	api.Get("/challenges/:id/quiz", handlers.GetQuiz)
	api.Post("/challenges/:id/quiz", handlers.SubmitQuiz)
	// Authoring — the teacher's Challenge Builder. Staff only.
	api.Post("/challenges", middleware.IsLibrarian, handlers.CreateChallenge)
	api.Post("/challenges/:id/questions", middleware.IsLibrarian, handlers.AddQuizQuestion)
	api.Delete("/challenges/:id", middleware.IsLibrarian, handlers.DeleteChallenge)

	// ... (Student Routes) ...
	api.Get("/books", handlers.GetBooks)
	api.Get("/my-library/:id", handlers.GetMyLibrary)
	api.Get("/student/:id/stats", handlers.GetStudentStats)
	api.Post("/reservation", handlers.RequestReservation)
	api.Get("/books/:id", handlers.GetBookDetails)

	// Reading diary (student writes own; owner or scoped staff read)
	api.Post("/reading-log", handlers.AddReadingLog)
	api.Get("/reading-log/:loanId", handlers.GetLoanReadingLogs)
	api.Get("/student/:id/reading", handlers.GetStudentReading)
	api.Get("/student/:id/holds", handlers.GetStudentHolds)

	// Book requests — student asks for a book the branch lacks
	api.Post("/book-requests", handlers.CreateBookRequest)
	api.Get("/book-requests/mine", handlers.GetMyBookRequests)

	// ===========================
	// LIBRARIAN ROUTES
	// ===========================

	// Inventory
	api.Post("/books", middleware.IsLibrarian, handlers.AddBook)
	api.Put("/books/:id", middleware.IsLibrarian, handlers.UpdateBook)
	api.Delete("/books/:id", middleware.IsLibrarian, handlers.DeleteBook)
	api.Post("/books/bulk", middleware.IsLibrarian, handlers.BulkUploadBooks)

	api.Post("/books/copy", middleware.IsLibrarian, handlers.AddCopy)
	api.Put("/copy/:id", middleware.IsLibrarian, handlers.UpdateCopy)
	api.Delete("/copy/:id", middleware.IsLibrarian, handlers.DeleteCopy)

	// Branch policy settings (borrow limit + max pickup days) and per-student override
	api.Get("/branch-settings", middleware.IsLibrarian, handlers.GetBranchSettings)
	api.Put("/branch-settings", middleware.IsLibrarian, handlers.UpdateBranchSettings)
	api.Get("/loan-limit", middleware.IsLibrarian, handlers.GetLoanLimit)
	api.Put("/loan-limit", middleware.IsLibrarian, handlers.SetLoanLimit)
	api.Put("/student/:id/limit", middleware.IsLibrarian, handlers.SetStudentLimit)

	// Loan Operations
	api.Post("/loan", middleware.IsLibrarian, handlers.CreateLoan)
	api.Post("/return/:id", middleware.IsLibrarian, handlers.ReturnBook)

	api.Put("/loans/:id", middleware.IsLibrarian, handlers.UpdateLoan)
	api.Get("/loans", middleware.IsLibrarian, handlers.GetActiveLoans)

	// Reservation Operations
	api.Get("/reservations", middleware.IsLibrarian, handlers.GetAllReservations)
	api.Post("/reservation/:id", middleware.IsLibrarian, handlers.HandleReservation)
	api.Post("/reservation/:id/issue", middleware.IsLibrarian, handlers.IssueReservation)

	// Book requests — librarian queue for their branch
	api.Get("/book-requests", middleware.IsLibrarian, handlers.GetBranchBookRequests)
	api.Put("/book-requests/:id", middleware.IsLibrarian, handlers.UpdateBookRequestStatus)

	// Class & Student Data
	api.Get("/class-list", middleware.IsLibrarian, handlers.GetClassList)

	// Circulation desk: KPIs, today's counter activity and the overdue list.
	api.Get("/desk/summary", middleware.IsLibrarian, handlers.GetDeskSummary)

	// Registration tokens (invite links)
	api.Get("/registration-tokens", middleware.IsLibrarian, handlers.GetRegistrationTokens)
	api.Post("/registration-tokens", middleware.IsLibrarian, handlers.CreateRegistrationToken)
	api.Delete("/registration-tokens/:id", middleware.IsLibrarian, handlers.DeleteRegistrationToken)

	// ===========================
	// SETTINGS & DYNAMIC CATEGORIES
	// ===========================

	// Authors
	api.Get("/authors", middleware.IsLibrarian, handlers.GetAuthors)
	api.Post("/authors", middleware.IsLibrarian, handlers.CreateAuthor)
	api.Put("/authors/:id", middleware.IsLibrarian, handlers.UpdateAuthor)
	api.Delete("/authors/:id", middleware.IsLibrarian, handlers.DeleteAuthor)

	// Publishers
	api.Get("/publishers", middleware.IsLibrarian, handlers.GetPublishers)
	api.Post("/publishers", middleware.IsLibrarian, handlers.CreatePublisher)
	api.Put("/publishers/:id", middleware.IsLibrarian, handlers.UpdatePublisher)
	api.Delete("/publishers/:id", middleware.IsLibrarian, handlers.DeletePublisher)

	// Topics
	api.Get("/topics", middleware.IsLibrarian, handlers.GetTopics)
	api.Post("/topics", middleware.IsLibrarian, handlers.CreateTopic)
	api.Put("/topics/:id", middleware.IsLibrarian, handlers.UpdateTopic)
	api.Delete("/topics/:id", middleware.IsLibrarian, handlers.DeleteTopic)

	// Genres
	api.Get("/genres", middleware.IsLibrarian, handlers.GetGenres)
	api.Post("/genres", middleware.IsLibrarian, handlers.CreateGenre)
	api.Put("/genres/:id", middleware.IsLibrarian, handlers.UpdateGenre)
	api.Delete("/genres/:id", middleware.IsLibrarian, handlers.DeleteGenre)

	// Frequencies
	api.Get("/frequencies", middleware.IsLibrarian, handlers.GetFrequencies)
	api.Post("/frequencies", middleware.IsLibrarian, handlers.CreateFrequency)
	api.Put("/frequencies/:id", middleware.IsLibrarian, handlers.UpdateFrequency)
	api.Delete("/frequencies/:id", middleware.IsLibrarian, handlers.DeleteFrequency)

	// Copy Conditions (Physical)
	api.Get("/copy-conditions", middleware.IsLibrarian, handlers.GetCopyConditions)
	api.Post("/copy-conditions", middleware.IsLibrarian, handlers.CreateCopyCondition)
	api.Put("/copy-conditions/:id", middleware.IsLibrarian, handlers.UpdateCopyCondition)
	api.Delete("/copy-conditions/:id", middleware.IsLibrarian, handlers.DeleteCopyCondition)

	// Copy Statuses (Demirbaş Durumu)
	api.Get("/copy-statuses", middleware.IsLibrarian, handlers.GetCopyStatuses)
	api.Post("/copy-statuses", middleware.IsLibrarian, handlers.CreateCopyStatus)
	api.Put("/copy-statuses/:id", middleware.IsLibrarian, handlers.UpdateCopyStatus)
	api.Delete("/copy-statuses/:id", middleware.IsLibrarian, handlers.DeleteCopyStatus)

	// Loan Statuses
	api.Get("/loan-statuses", middleware.IsLibrarian, handlers.GetLoanStatuses)
	api.Post("/loan-statuses", middleware.IsLibrarian, handlers.CreateLoanStatus)
	api.Put("/loan-statuses/:id", middleware.IsLibrarian, handlers.UpdateLoanStatus)
	api.Delete("/loan-statuses/:id", middleware.IsLibrarian, handlers.DeleteLoanStatus)

	// Reservation Statuses
	api.Get("/reservation-statuses", middleware.IsLibrarian, handlers.GetReservationStatuses)
	api.Post("/reservation-statuses", middleware.IsLibrarian, handlers.CreateReservationStatus)
	api.Put("/reservation-statuses/:id", middleware.IsLibrarian, handlers.UpdateReservationStatus)
	api.Delete("/reservation-statuses/:id", middleware.IsLibrarian, handlers.DeleteReservationStatus)

	// ===========================
	// ADMIN ROUTES
	// ===========================

	api.Post("/admin/school", middleware.IsAdmin, handlers.CreateSchool)
	api.Get("/admin/school", middleware.IsAdmin, handlers.GetAllSchools)
	api.Get("/admin/school/:id", middleware.IsAdmin, handlers.GetSchoolDetails)
	api.Delete("/admin/school/:id", middleware.IsAdmin, handlers.DeleteSchool)
	api.Put("/admin/school/:id", middleware.IsAdmin, handlers.UpdateSchool)

	api.Post("/admin/branch", middleware.IsAdmin, handlers.CreateBranch)
	api.Put("/admin/branch/:id", middleware.IsAdmin, handlers.UpdateBranch)
	api.Delete("/admin/branch/:id", middleware.IsAdmin, handlers.DeleteBranch)

	api.Post("/admin/librarian", middleware.IsAdmin, handlers.AddLibrarian)
	api.Put("/admin/librarian/:id", middleware.IsAdmin, handlers.UpdateLibrarian)
	api.Delete("/admin/librarian/:id", middleware.IsAdmin, handlers.RemoveLibrarian)

	// Managers are provisioned by the admin, one login per school (many allowed).
	api.Post("/admin/manager", middleware.IsAdmin, handlers.AddManager)
	api.Put("/admin/manager/:id", middleware.IsAdmin, handlers.UpdateManager)
	api.Delete("/admin/manager/:id", middleware.IsAdmin, handlers.RemoveManager)

	// ===========================
	// MANAGER ROUTES (school-scoped; every handler enforces the caller's own school)
	// ===========================

	api.Get("/manager/school", middleware.IsManager, handlers.GetMySchool)
	api.Put("/manager/school", middleware.IsManager, handlers.ManagerUpdateSchool)
	api.Get("/manager/students", middleware.IsManager, handlers.ManagerGetStudents)
	api.Get("/manager/librarian-stats", middleware.IsManager, handlers.ManagerLibrarianStats)

	// Manager read-only workspace into any branch of their school
	api.Get("/manager/branch/:branchId/books", middleware.IsManager, handlers.ManagerGetBranchBooks)
	api.Get("/manager/branch/:branchId/loans", middleware.IsManager, handlers.ManagerGetBranchLoans)
	api.Get("/manager/branch/:branchId/reservations", middleware.IsManager, handlers.ManagerGetBranchReservations)

	api.Post("/manager/branch", middleware.IsManager, handlers.ManagerCreateBranch)
	api.Put("/manager/branch/:id", middleware.IsManager, handlers.ManagerUpdateBranch)
	api.Delete("/manager/branch/:id", middleware.IsManager, handlers.ManagerDeleteBranch)

	api.Post("/manager/librarian", middleware.IsManager, handlers.ManagerAddLibrarian)
	api.Put("/manager/librarian/:id", middleware.IsManager, handlers.ManagerUpdateLibrarian)
	api.Delete("/manager/librarian/:id", middleware.IsManager, handlers.ManagerRemoveLibrarian)

	// Manager sees/handles book requests across their whole school
	api.Get("/manager/book-requests", middleware.IsManager, handlers.GetSchoolBookRequests)
	api.Put("/manager/book-requests/:id", middleware.IsManager, handlers.ManagerUpdateBookRequestStatus)
}
