package database

import (
	"log"

	"school-library-system/models"
)

// The copy, loan and reservation statuses were seeded in Turkish, and their
// Name is what several screens print. The reader app now translates from the
// stable Code instead, but anything reading Name directly — the settings
// screens, the old dashboards, a CSV export — still showed an Azerbaijani
// school Turkish words.
//
// Code is the key and never changes; only the label does.
//
// A librarian may rename any of these from Kitabxana ayarları, so the rename
// below touches a row only while it still holds the exact Turkish default.
// Anything somebody has edited is theirs and is left alone.

type statusName struct{ code, turkish, azerbaijani string }

var copyStatusNames = []statusName{
	{"AVAILABLE", "Müsait", "Mövcuddur"},
	{"LOANED", "Ödünç Verildi", "Verilib"},
	{"RESERVED", "Rezerve", "Rezerv edilib"},
}

var loanStatusNames = []statusName{
	{"ACTIVE", "Aktif", "Aktiv"},
	{"RETURNED", "İade Edildi", "Qaytarılıb"},
}

var reservationStatusNames = []statusName{
	{"PENDING", "Bekliyor", "Gözləyir"},
	{"APPROVED", "Onaylandı", "Təsdiqlənib"},
	{"REJECTED", "Reddedildi", "Rədd edilib"},
	{"COMPLETED", "Tamamlandı", "Tamamlanıb"},
	{"EXPIRED", "Süresi Doldu", "Müddəti bitib"},
}

// LocaliseStatusNames renames the seeded Turkish status labels into
// Azerbaijani. Idempotent: a row already carrying the Azerbaijani name, or a
// name a librarian chose, matches nothing and is skipped.
func LocaliseStatusNames() {
	renamed := 0

	rename := func(model interface{}, names []statusName) {
		for _, n := range names {
			res := DB.Model(model).
				Where("code = ? AND name = ?", n.code, n.turkish).
				Update("name", n.azerbaijani)
			renamed += int(res.RowsAffected)
		}
	}

	rename(&models.CopyStatus{}, copyStatusNames)
	rename(&models.LoanStatus{}, loanStatusNames)
	rename(&models.ReservationStatus{}, reservationStatusNames)

	if renamed > 0 {
		log.Printf("[i18n] status names: %d Turkish labels renamed to Azerbaijani", renamed)
	}
}

// azerbaijaniFor is what a freshly seeded branch should be given, so a new
// branch never starts out in Turkish again.
func azerbaijaniFor(names []statusName, code string) string {
	for _, n := range names {
		if n.code == code {
			return n.azerbaijani
		}
	}
	return code
}
