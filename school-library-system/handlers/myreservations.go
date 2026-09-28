package handlers

import (
	"strconv"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// A student could always create a reservation, but never see or cancel their
// own — the list was librarian-only. These fill that gap so the booking side of
// the library is usable from the reader's own screens.

// MyReservation is one of the caller's bookings, with everything the card needs.
type MyReservation struct {
	ID             uint       `json:"id"`
	BookID         uint       `json:"book_id"`
	EditionID      *uint      `json:"edition_id"`
	Title          string     `json:"title"`
	Author         string     `json:"author"`
	CoverURL       string     `json:"cover_url"`
	TrackingNumber string     `json:"tracking_number"`
	Branch         string     `json:"branch"`
	RequestDate    time.Time  `json:"request_date"`
	PickupDeadline *time.Time `json:"pickup_deadline"`
	Status         string     `json:"status"`      // librarian-editable display name
	StatusCode     string     `json:"status_code"` // PENDING / APPROVED / REJECTED / COMPLETED / EXPIRED
	// CanCancel is false once a librarian has issued or rejected it.
	CanCancel bool `json:"can_cancel"`
}

// GetMyReservations lists the caller's own bookings, newest first.
func GetMyReservations(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var rows []models.Reservation
	if err := database.DB.
		Preload("Status").
		Preload("BookCopy").
		Preload("BookCopy.Book").Preload("BookCopy.Book.CatalogEdition").
		Preload("BookCopy.Book.Author").
		Preload("BookCopy.Book.Branch").
		Where("student_id = ?", uid).
		Order("request_date desc").
		Find(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load reservations"})
	}

	out := make([]MyReservation, 0, len(rows))
	for _, r := range rows {
		b := r.BookCopy.Book
		out = append(out, MyReservation{
			ID: r.ID, BookID: b.ID, EditionID: b.EditionID,
			Title: b.Title, Author: b.Author.Name, CoverURL: b.CoverURL,
			TrackingNumber: r.BookCopy.TrackingNumber, Branch: b.Branch.Name,
			RequestDate: r.RequestDate, PickupDeadline: r.PickupDeadline,
			Status: r.Status.Name, StatusCode: r.Status.Code,
			// Only a booking still waiting on the desk is the reader's to withdraw.
			CanCancel: r.Status.Code == "PENDING" || r.Status.Code == "APPROVED",
		})
	}
	return c.JSON(out)
}

// CancelMyReservation withdraws the caller's own booking and frees the copy.
// Scoped by student id, so one reader cannot cancel another's.
func CancelMyReservation(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var res models.Reservation
	if err := database.DB.Preload("Status").Preload("BookCopy").
		Where("id = ? AND student_id = ?", id, uid).First(&res).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Reservation not found"})
	}
	if res.Status.Code != "PENDING" && res.Status.Code != "APPROVED" {
		return c.Status(400).JSON(fiber.Map{
			"error": "This reservation can no longer be cancelled", "code": "NOT_CANCELLABLE",
		})
	}

	// Free the copy so somebody else can take it.
	var available models.CopyStatus
	if err := database.DB.
		Where("branch_id = ? AND code = ?", res.BookCopy.Book.BranchID, "AVAILABLE").
		First(&available).Error; err == nil {
		database.DB.Model(&models.BookCopy{}).Where("id = ?", res.BookCopyID).
			Update("status_id", available.ID)
	} else {
		// Fall back to the copy's own branch via a join when the preload was thin.
		var copyRow models.BookCopy
		if database.DB.Preload("Book").Preload("Book.CatalogEdition").First(&copyRow, res.BookCopyID).Error == nil {
			var st models.CopyStatus
			if database.DB.Where("branch_id = ? AND code = ?", copyRow.Book.BranchID, "AVAILABLE").
				First(&st).Error == nil {
				database.DB.Model(&models.BookCopy{}).Where("id = ?", res.BookCopyID).
					Update("status_id", st.ID)
			}
		}
	}

	database.DB.Delete(&models.Reservation{}, res.ID)
	return c.JSON(fiber.Map{"cancelled": true})
}
