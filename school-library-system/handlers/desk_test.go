package handlers

import (
	"testing"
	"time"
)

// The bug this pins: a loan overdue by less than a day was counted as overdue
// but reported zero days, so the desk listed a book as late while the reminder
// told the reader it was "0 gün gecikib". The predicate and the count now come
// from the same calendar comparison, so the boundary is worth holding still.
func TestOverdueDays(t *testing.T) {
	loc := time.UTC
	at := func(y int, m time.Month, d, h int) time.Time {
		return time.Date(y, m, d, h, 0, 0, 0, loc)
	}

	cases := []struct {
		name string
		due  time.Time
		now  time.Time
		want int
	}{
		// A book due today is not late, whatever the clock says. This is the
		// case that used to report "overdue, 0 days".
		{"due today, early", at(2026, 10, 13, 9), at(2026, 10, 13, 9), 0},
		{"due today, later the same day", at(2026, 10, 13, 9), at(2026, 10, 13, 23), 0},
		{"due today at midnight, late evening", at(2026, 10, 13, 0), at(2026, 10, 13, 22), 0},

		// Not yet due.
		{"due tomorrow", at(2026, 10, 14, 9), at(2026, 10, 13, 23), 0},
		{"due next week", at(2026, 10, 20, 9), at(2026, 10, 13, 9), 0},

		// Late. A book due on the 13th is one day late on the 14th, even a
		// minute after midnight, and regardless of the hour it was issued.
		{"one day late, just after midnight", at(2026, 10, 13, 14), at(2026, 10, 14, 0), 1},
		{"one day late, evening", at(2026, 10, 13, 9), at(2026, 10, 14, 23), 1},
		{"four days late", at(2026, 10, 13, 9), at(2026, 10, 17, 9), 4},
		{"across a month boundary", at(2026, 9, 28, 9), at(2026, 10, 2, 9), 4},
		{"the 14-day threshold the desk flags", at(2026, 10, 1, 9), at(2026, 10, 15, 9), 14},
	}

	for _, c := range cases {
		if got := overdueDays(c.due, c.now); got != c.want {
			t.Errorf("%s: overdueDays(%s, %s) = %d, want %d",
				c.name, c.due.Format(time.RFC3339), c.now.Format(time.RFC3339), got, c.want)
		}
	}
}

// Whatever else changes, a loan reported as overdue must never be reported as
// zero days overdue: that pair is the contradiction a reader actually saw.
func TestOverdueCountAgreesWithPredicate(t *testing.T) {
	due := time.Date(2026, 10, 13, 14, 30, 0, 0, time.UTC)

	// Walk a fortnight in hourly steps around the due date.
	for h := -48; h < 24*14; h++ {
		now := due.Add(time.Duration(h) * time.Hour)
		days := overdueDays(due, now)
		if days < 0 {
			t.Fatalf("negative days at %s: %d", now.Format(time.RFC3339), days)
		}
		// "Overdue" is defined as days > 0, so there is no hour at which a
		// loan can be overdue and nought days late at the same time.
		if days > 0 && now.Format("2006-01-02") <= due.Format("2006-01-02") {
			t.Fatalf("%s: counted %d days late while still on or before the due date",
				now.Format(time.RFC3339), days)
		}
		if days == 0 && now.Format("2006-01-02") > due.Format("2006-01-02") {
			t.Fatalf("%s: past the due date but counted as not late", now.Format(time.RFC3339))
		}
	}
}
