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

	api := app.Group("/api", middleware.IsAuthenticated)

	// ... (Student Routes) ...
	api.Get("/books", handlers.GetBooks)
	api.Get("/my-library/:id", handlers.GetMyLibrary)
	api.Get("/student/:id/stats", handlers.GetStudentStats)
	api.Post("/reservation", handlers.RequestReservation)
	api.Get("/books/:id", handlers.GetBookDetails)

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

	// Loan Operations
	api.Post("/loan", middleware.IsLibrarian, handlers.CreateLoan)
	api.Post("/return/:id", middleware.IsLibrarian, handlers.ReturnBook)

	api.Put("/loans/:id", middleware.IsLibrarian, handlers.UpdateLoan)
	api.Get("/loans", middleware.IsLibrarian, handlers.GetActiveLoans)

	// Reservation Operations
	api.Get("/reservations", middleware.IsLibrarian, handlers.GetAllReservations)
	api.Post("/reservation/:id", middleware.IsLibrarian, handlers.HandleReservation)
	api.Post("/reservation/:id/issue", middleware.IsLibrarian, handlers.IssueReservation)

	// Class & Student Data
	api.Get("/class-list", middleware.IsLibrarian, handlers.GetClassList)

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

	app.Get("/debug/librarians", handlers.DebugLibrarians)
}
