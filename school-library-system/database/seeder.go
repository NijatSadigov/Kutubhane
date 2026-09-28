package database

import "school-library-system/models"

func SeedDefaultStatusesForBranch(branchID uint) {
	// Check if this branch already has statuses (to prevent duplicates)
	var count int64
	DB.Model(&models.CopyStatus{}).Where("branch_id = ?", branchID).Count(&count)
	if count > 0 {
		return // Already seeded!
	}

	// The labels come from one table shared with the rename migration, so a new
	// branch is seeded in Azerbaijani and an old one is corrected to the same
	// words. Code is the key throughout; Name is only what people read.
	for _, n := range copyStatusNames {
		DB.Create(&models.CopyStatus{BranchID: branchID, Name: n.azerbaijani, Code: n.code})
	}
	for _, n := range loanStatusNames {
		DB.Create(&models.LoanStatus{BranchID: branchID, Name: n.azerbaijani, Code: n.code})
	}
	for _, n := range reservationStatusNames {
		DB.Create(&models.ReservationStatus{BranchID: branchID, Name: n.azerbaijani, Code: n.code})
	}
}

// EnsureExpiredReservationStatus backfills the EXPIRED reservation status for a
// branch seeded before that status existed. Idempotent.
func EnsureExpiredReservationStatus(branchID uint) {
	var c int64
	DB.Model(&models.ReservationStatus{}).Where("branch_id = ? AND code = 'EXPIRED'", branchID).Count(&c)
	if c == 0 {
		DB.Create(&models.ReservationStatus{
			BranchID: branchID,
			Name:     azerbaijaniFor(reservationStatusNames, "EXPIRED"),
			Code:     "EXPIRED",
		})
	}
}
