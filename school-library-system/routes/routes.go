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
	// 4. LIBRARIAN ROUTES
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

	api.Get("/reservations", middleware.IsLibrarian, handlers.GetAllReservations)
	api.Post("/reservation/:id", middleware.IsLibrarian, handlers.HandleReservation)

	api.Post("/reservation/:id/issue", middleware.IsLibrarian, handlers.IssueReservation)

	api.Get("/class-list", middleware.IsLibrarian, handlers.GetClassList)

	// ... (Admin Routes) ...
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
