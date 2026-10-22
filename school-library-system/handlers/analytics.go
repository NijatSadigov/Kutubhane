package handlers

import (
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// School analytics: what a school administrator has never had a screen for.
//
// Every number here is derived from the ledgers the daily work already writes —
// loans, the reading diary, quiz attempts, the textbook movements. Nothing is
// stored and nothing asks a librarian to fill in a report, which is the whole
// reason the figures can be trusted: a number cannot drift away from the rows
// it is summed from.
//
// EVERY figure on this screen is scoped to the selected period, pages
// included. That matters more than it sounds: a table showing "2 books" beside
// "150 pages", where the first is this term and the second is all time, reads
// as one fact and is two. One time basis, or none.
//
// PAGES is therefore how much further readers got during the period: the
// furthest page reached in a book by the end, minus the furthest reached in it
// before the period started, never below zero. A book begun last term does not
// donate its earlier pages to this one. The per-book "furthest page reached"
// rule is the same one readerMetrics() in shelf.go uses for a reader's own
// profile — summing every diary row instead would count the same pages again
// each time a reader logged progress.
//
// An "active reader" is one who borrowed at least one book in the period. It
// deliberately counts borrowing rather than logging, because a reader who takes
// books out without keeping a diary is still reading.

// analyticsScope resolves which school is being asked about. A manager gets
// their own and cannot ask for another; a platform admin has no school of their
// own, so they may name one with ?school_id= and otherwise get the first.
func analyticsScope(c *fiber.Ctx) (uint, error) {
	uid, err := currentUserID(c)
	if err != nil {
		return 0, err
	}

	var mgr models.Manager
	if err := database.DB.Where("user_id = ?", uid).First(&mgr).Error; err == nil {
		// The school comes from the identity, never the query string.
		return mgr.SchoolID, nil
	}

	// Platform admin.
	if want := uint(c.QueryInt("school_id")); want > 0 {
		var s models.School
		if err := database.DB.First(&s, want).Error; err == nil {
			return s.ID, nil
		}
		return 0, fiber.NewError(fiber.StatusNotFound, "No such school")
	}
	return callerSchoolID(c)
}

// pagesAdvanced sums how much further readers got during the period, over the
// readers an extra WHERE clause selects. One definition, used by the headline,
// the branch table and the class table, so the three cannot drift apart.
//
// `extra` is appended to the reader filter (for example "AND s.grade = ?") and
// its arguments follow in `args`.
func pagesAdvanced(branchIDs []uint, since time.Time, extra string, args ...any) int {
	var out struct{ Total int }
	q := `
		SELECT COALESCE(SUM(GREATEST(inp.mx - COALESCE(pre.mx, 0), 0)), 0) AS total
		FROM (
			SELECT rl.loan_id, MAX(rl.page) AS mx
			FROM reading_logs rl JOIN students s ON s.user_id = rl.student_id
			WHERE s.branch_id IN ? AND rl.created_at >= ? ` + extra + `
			GROUP BY rl.loan_id
		) inp
		LEFT JOIN (
			SELECT rl.loan_id, MAX(rl.page) AS mx
			FROM reading_logs rl JOIN students s ON s.user_id = rl.student_id
			WHERE s.branch_id IN ? AND rl.created_at < ? ` + extra + `
			GROUP BY rl.loan_id
		) pre ON pre.loan_id = inp.loan_id`

	// The filter appears twice, so its arguments do too.
	all := []any{branchIDs, since}
	all = append(all, args...)
	all = append(all, branchIDs, since)
	all = append(all, args...)
	database.DB.Raw(q, all...).Scan(&out)
	return out.Total
}

type branchRow struct {
	ID       uint   `json:"id"`
	Name     string `json:"name"`
	Readers  int    `json:"readers"`
	Active   int    `json:"active"`
	ActivePc int    `json:"active_pct"`
	Loans    int    `json:"loans"`
	Pages    int    `json:"pages"`
	PerCap   int    `json:"pages_per_reader"`
}

type classRow struct {
	Grade    int    `json:"grade"`
	Group    string `json:"class_group"`
	Readers  int    `json:"readers"`
	Active   int    `json:"active"`
	ActivePc int    `json:"active_pct"`
	Loans    int    `json:"loans"`
	Pages    int    `json:"pages"`
}

// GetSchoolAnalytics backs /staff/analytics. Guarded by IsManager, which admits
// a school administrator and a platform admin.
func GetSchoolAnalytics(c *fiber.Ctx) error {
	schoolID, err := analyticsScope(c)
	if err != nil {
		if fe, ok := err.(*fiber.Error); ok {
			return c.Status(fe.Code).JSON(fiber.Map{"error": fe.Message})
		}
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}

	days := c.QueryInt("days")
	if days != 30 && days != 90 && days != 365 {
		days = 90
	}
	since := time.Now().AddDate(0, 0, -days)

	var school models.School
	database.DB.First(&school, schoolID)

	branchIDs := branchesOf(schoolID)
	if len(branchIDs) == 0 {
		// A school with no branches yet is a real state, not an error: say so
		// with zeros rather than an empty screen that looks broken.
		return c.JSON(fiber.Map{
			"school":      fiber.Map{"id": school.ID, "name": school.Name},
			"period_days": days,
			"totals":      fiber.Map{},
			"branches":    []branchRow{},
			"classes":     []classRow{},
			"weeks":       []fiber.Map{},
			"top_titles":  []fiber.Map{},
			"textbooks":   fiber.Map{},
		})
	}

	// --- headline counts -----------------------------------------------
	var readers int64
	database.DB.Model(&models.Student{}).Where("branch_id IN ?", branchIDs).Count(&readers)

	var titles, copies int64
	database.DB.Model(&models.Book{}).Where("branch_id IN ?", branchIDs).Count(&titles)
	database.DB.Model(&models.BookCopy{}).
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.branch_id IN ?", branchIDs).Count(&copies)

	var loansInPeriod, activeReaders int64
	database.DB.Model(&models.Loan{}).
		Joins("JOIN students ON students.user_id = loans.student_id").
		Where("students.branch_id IN ? AND loans.issue_date >= ?", branchIDs, since).
		Count(&loansInPeriod)
	database.DB.Model(&models.Loan{}).
		Joins("JOIN students ON students.user_id = loans.student_id").
		Where("students.branch_id IN ? AND loans.issue_date >= ?", branchIDs, since).
		Distinct("loans.student_id").Count(&activeReaders)

	pagesPeriod := pagesAdvanced(branchIDs, since, "")

	var quizzes int64
	database.DB.Table("quiz_attempts").
		Joins("JOIN students ON students.user_id = quiz_attempts.user_id").
		Where("students.branch_id IN ? AND quiz_attempts.passed = true AND quiz_attempts.created_at >= ?",
			branchIDs, since).Count(&quizzes)

	activePct := 0
	if readers > 0 {
		activePct = int(float64(activeReaders)/float64(readers)*100 + 0.5)
	}
	perReader := 0.0
	if readers > 0 {
		perReader = float64(loansInPeriod) / float64(readers)
	}

	// --- per branch ------------------------------------------------------
	branches := []branchRow{}
	{
		var rows []models.Branch
		database.DB.Where("school_id = ?", schoolID).Order("name").Find(&rows)
		for _, b := range rows {
			r := branchRow{ID: b.ID, Name: b.Name}
			var n, act, ln int64
			database.DB.Model(&models.Student{}).Where("branch_id = ?", b.ID).Count(&n)
			database.DB.Model(&models.Loan{}).
				Joins("JOIN students ON students.user_id = loans.student_id").
				Where("students.branch_id = ? AND loans.issue_date >= ?", b.ID, since).Count(&ln)
			database.DB.Model(&models.Loan{}).
				Joins("JOIN students ON students.user_id = loans.student_id").
				Where("students.branch_id = ? AND loans.issue_date >= ?", b.ID, since).
				Distinct("loans.student_id").Count(&act)

			pages := pagesAdvanced([]uint{b.ID}, since, "")

			r.Readers, r.Active, r.Loans, r.Pages = int(n), int(act), int(ln), pages
			if n > 0 {
				r.ActivePc = int(float64(act)/float64(n)*100 + 0.5)
				// Per reader, so a small branch is not beaten by a big one for
				// being small — the same rule the readers' own league uses.
				r.PerCap = pages / int(n)
			}
			branches = append(branches, r)
		}
	}

	// --- per class -------------------------------------------------------
	// Readers with no class land in grade 0, which is worth seeing: it means
	// they signed up through a link that set none.
	classes := []classRow{}
	{
		type raw struct {
			Grade      int
			ClassGroup string
			Readers    int
		}
		var rows []raw
		database.DB.Model(&models.Student{}).
			Select("grade, class_group, count(*) as readers").
			Where("branch_id IN ?", branchIDs).
			Group("grade, class_group").Order("grade, class_group").Scan(&rows)

		for _, g := range rows {
			r := classRow{Grade: g.Grade, Group: g.ClassGroup, Readers: g.Readers}
			var act, ln int64
			database.DB.Model(&models.Loan{}).
				Joins("JOIN students ON students.user_id = loans.student_id").
				Where("students.branch_id IN ? AND students.grade = ? AND students.class_group = ? AND loans.issue_date >= ?",
					branchIDs, g.Grade, g.ClassGroup, since).Count(&ln)
			database.DB.Model(&models.Loan{}).
				Joins("JOIN students ON students.user_id = loans.student_id").
				Where("students.branch_id IN ? AND students.grade = ? AND students.class_group = ? AND loans.issue_date >= ?",
					branchIDs, g.Grade, g.ClassGroup, since).
				Distinct("loans.student_id").Count(&act)

			pages := pagesAdvanced(branchIDs, since,
				"AND s.grade = ? AND s.class_group = ?", g.Grade, g.ClassGroup)

			r.Active, r.Loans, r.Pages = int(act), int(ln), pages
			if g.Readers > 0 {
				r.ActivePc = int(float64(act)/float64(g.Readers)*100 + 0.5)
			}
			classes = append(classes, r)
		}
	}

	// --- eight-week trend -------------------------------------------------
	weeks := []fiber.Map{}
	{
		type wk struct {
			Wk time.Time
			N  int
		}
		var rows []wk
		database.DB.Raw(`
			SELECT date_trunc('week', l.issue_date) AS wk, count(*) AS n
			FROM loans l JOIN students s ON s.user_id = l.student_id
			WHERE s.branch_id IN ? AND l.issue_date >= ?
			GROUP BY 1 ORDER BY 1`, branchIDs, time.Now().AddDate(0, 0, -56)).Scan(&rows)
		for _, r := range rows {
			weeks = append(weeks, fiber.Map{"week": r.Wk.Format("2006-01-02"), "loans": r.N})
		}
	}

	// --- most borrowed ----------------------------------------------------
	top := []fiber.Map{}
	{
		type row struct {
			Title string
			N     int
		}
		var rows []row
		database.DB.Raw(`
			SELECT COALESCE(NULLIF(e.title, ''), b.title) AS title, count(*) AS n
			FROM loans l
			JOIN book_copies bc ON bc.id = l.book_copy_id
			JOIN books b ON b.id = bc.book_id
			LEFT JOIN editions e ON e.id = b.edition_id
			WHERE b.branch_id IN ? AND l.issue_date >= ?
			GROUP BY 1 ORDER BY n DESC, title ASC LIMIT 8`, branchIDs, since).Scan(&rows)
		for _, r := range rows {
			top = append(top, fiber.Map{"title": r.Title, "loans": r.N})
		}
	}

	// --- textbooks --------------------------------------------------------
	// Summed from the movement ledger, never stored — the same rule the class
	// textbook screen uses, so the two cannot disagree.
	textbooks := fiber.Map{}
	{
		type mv struct {
			Kind string
			N    int
		}
		var rows []mv
		// textbook_movements carries its own branch_id, so no join is needed —
		// and the quantity column is `qty`.
		database.DB.Raw(`
			SELECT kind, COALESCE(SUM(qty),0) AS n
			FROM textbook_movements
			WHERE branch_id IN ?
			GROUP BY kind`, branchIDs).Scan(&rows)

		issued, returned, lost := 0, 0, 0
		for _, r := range rows {
			switch r.Kind {
			case models.MoveIssue:
				issued += r.N
			case models.MoveReturn:
				returned += r.N
			case models.MoveLost, models.MoveDamaged:
				lost += r.N
			}
		}
		recovery := 0
		if issued > 0 {
			recovery = int(float64(returned+lost)/float64(issued)*100 + 0.5)
		}
		textbooks = fiber.Map{
			"issued": issued, "returned": returned, "written_off": lost,
			"outstanding": issued - returned - lost, "accounted_pct": recovery,
		}
	}

	return c.JSON(fiber.Map{
		"school":      fiber.Map{"id": school.ID, "name": school.Name},
		"period_days": days,
		"totals": fiber.Map{
			"readers": readers, "active_readers": activeReaders, "active_pct": activePct,
			"loans": loansInPeriod, "loans_per_reader": perReader,
			"pages_in_period": pagesPeriod,
			"quizzes_passed":  quizzes, "titles": titles, "copies": copies,
		},
		"branches":   branches,
		"classes":    classes,
		"weeks":      weeks,
		"top_titles": top,
		"textbooks":  textbooks,
	})
}
