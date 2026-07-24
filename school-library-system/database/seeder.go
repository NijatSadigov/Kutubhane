package database

import "school-library-system/models"

func SeedDefaultStatusesForBranch(branchID uint) {
	// Check if this branch already has statuses (to prevent duplicates)
	var count int64
	DB.Model(&models.CopyStatus{}).Where("branch_id = ?", branchID).Count(&count)
	if count > 0 {
		return // Already seeded!
	}

	// 1. Core Copy Statuses
	DB.Create(&models.CopyStatus{BranchID: branchID, Name: "Müsait", Code: "AVAILABLE"})
	DB.Create(&models.CopyStatus{BranchID: branchID, Name: "Ödünç Verildi", Code: "LOANED"})
	DB.Create(&models.CopyStatus{BranchID: branchID, Name: "Rezerve", Code: "RESERVED"})

	// 2. Core Loan Statuses
	DB.Create(&models.LoanStatus{BranchID: branchID, Name: "Aktif", Code: "ACTIVE"})
	DB.Create(&models.LoanStatus{BranchID: branchID, Name: "İade Edildi", Code: "RETURNED"})

	// 3. Core Reservation Statuses
	DB.Create(&models.ReservationStatus{BranchID: branchID, Name: "Bekliyor", Code: "PENDING"})
	DB.Create(&models.ReservationStatus{BranchID: branchID, Name: "Onaylandı", Code: "APPROVED"})
	DB.Create(&models.ReservationStatus{BranchID: branchID, Name: "Reddedildi", Code: "REJECTED"})
	DB.Create(&models.ReservationStatus{BranchID: branchID, Name: "Tamamlandı", Code: "COMPLETED"})
}
