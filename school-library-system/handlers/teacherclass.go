package handlers

import (
	"strconv"
	"strings"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// The teacher's class dashboard: how the children in front of them are reading.
//
// WHICH CLASSES: from `classroom_teachers`, the dərslik link, because that is
// where a teacher's authority over a class is actually recorded and managed.
//
// WHICH CHILDREN: matched on the students' own grade and class_group, NOT on
// students.classroom_id. The two drift — 11 of the demo readers have a grade
// and a letter but no classroom_id, because a classroom roster is assigned
// deliberately by the administration while the grade/letter pair is what a
// reader signs up with. Every reading feature in the product already groups on
// the pair: the class-against-class standings, Üzvlər's class cards, the class
// beside a name on the desk and under a review. A dashboard keyed on the other
// representation would quietly show a teacher a different set of children from
// the standings on the next screen.
//
// That divergence is worth closing at the point it is created — an invite link
// naming a class that already exists as a Classroom could set both — but that
// is a change to the sign-up path, not to this screen.

type classRef struct {
	Grade   int    `json:"grade"`
	Group   string `json:"class_group"`
	Label   string `json:"label"`
	Readers int    `json:"readers"`
}

type rosterRow struct {
	UserID   uint   `json:"user_id"`
	Name     string `json:"name"`
	Books    int    `json:"books"`
	Pages    int    `json:"pages"`
	Streak   int    `json:"streak"`
	Quizzes  int    `json:"quizzes"`
	Open     int    `json:"open_loans"`
	Overdue  int    `json:"overdue"`
	LastSeen string `json:"last_logged"`
}

// teacherClasses returns the classes a teacher takes, as grade/letter pairs.
// A librarian or the administration gets every class in their branch, since
// they may look at any of them.
func teacherClasses(c *fiber.Ctx, branchID uint) ([]classRef, error) {
	uid, err := currentUserID(c)
	if err != nil {
		return nil, err
	}
	role, _ := c.Locals("role").(string)

	type row struct {
		Grade  int
		Letter string
	}
	var rows []row

	if role == "teacher" {
		database.DB.Table("classrooms").
			Select("DISTINCT classrooms.grade, classrooms.letter").
			Joins("JOIN classroom_teachers ct ON ct.classroom_id = classrooms.id").
			Where("ct.teacher_user_id = ? AND classrooms.branch_id = ?", uid, branchID).
			Order("classrooms.grade, classrooms.letter").Scan(&rows)
	} else {
		database.DB.Table("classrooms").
			Select("DISTINCT classrooms.grade, classrooms.letter").
			Where("classrooms.branch_id = ?", branchID).
			Order("classrooms.grade, classrooms.letter").Scan(&rows)
	}

	out := make([]classRef, 0, len(rows))
	for _, r := range rows {
		letter := strings.ToUpper(strings.TrimSpace(r.Letter))
		var n int64
		database.DB.Model(&models.Student{}).
			Where("branch_id = ? AND grade = ? AND class_group = ?", branchID, r.Grade, letter).
			Count(&n)
		out = append(out, classRef{
			Grade: r.Grade, Group: letter,
			Label: strconv.Itoa(r.Grade) + "-" + letter, Readers: int(n),
		})
	}
	return out, nil
}

// GetTeacherClasses lists the classes the caller may look at.
func GetTeacherClasses(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	classes, err := teacherClasses(c, branchID)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	return c.JSON(fiber.Map{"classes": classes})
}

// GetTeacherClassDashboard is one class's reading, for the teacher who takes it.
func GetTeacherClassDashboard(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}

	grade := c.QueryInt("grade")
	group := strings.ToUpper(strings.TrimSpace(c.Query("group")))
	if grade <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "A class is required"})
	}

	// A teacher may only open a class they take. The check is against the list
	// rather than the query string, so asking for another class fails here
	// rather than quietly returning somebody else's children.
	classes, err := teacherClasses(c, branchID)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	allowed := false
	for _, cl := range classes {
		if cl.Grade == grade && cl.Group == group {
			allowed = true
			break
		}
	}
	if !allowed {
		return c.Status(403).JSON(fiber.Map{"error": "That is not one of your classes"})
	}

	days := c.QueryInt("days")
	if days != 30 && days != 90 && days != 365 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days)
	now := time.Now()

	var students []models.Student
	database.DB.Where("branch_id = ? AND grade = ? AND class_group = ?", branchID, grade, group).
		Order("name").Find(&students)

	ids := make([]uint, 0, len(students))
	for _, s := range students {
		ids = append(ids, s.UserID)
	}

	roster := make([]rosterRow, 0, len(students))
	activeReaders, totalBooks, totalPages, totalQuizzes, overdueTotal := 0, 0, 0, 0, 0

	for _, s := range students {
		r := rosterRow{UserID: s.UserID, Name: s.Name}

		// Books finished in the period.
		var books int64
		database.DB.Model(&models.Loan{}).
			Where("student_id = ? AND return_date IS NOT NULL AND return_date >= ?", s.UserID, since).
			Count(&books)
		r.Books = int(books)

		// Borrowed at all in the period: the definition of "active" used on
		// the school analytics screen, so the two agree.
		var borrowed int64
		database.DB.Model(&models.Loan{}).
			Where("student_id = ? AND issue_date >= ?", s.UserID, since).Count(&borrowed)
		if borrowed > 0 {
			activeReaders++
		}

		// Pages advanced in the period — the same rule the analytics screen
		// and the reader's own profile use.
		var p struct{ Total int }
		database.DB.Raw(`
			SELECT COALESCE(SUM(GREATEST(inp.mx - COALESCE(pre.mx, 0), 0)), 0) AS total
			FROM (
				SELECT loan_id, MAX(page) AS mx FROM reading_logs
				WHERE student_id = ? AND created_at >= ? GROUP BY loan_id
			) inp
			LEFT JOIN (
				SELECT loan_id, MAX(page) AS mx FROM reading_logs
				WHERE student_id = ? AND created_at < ? GROUP BY loan_id
			) pre ON pre.loan_id = inp.loan_id`,
			s.UserID, since, s.UserID, since).Scan(&p)
		r.Pages = p.Total

		m := readerMetrics(s.UserID)
		r.Streak = m[models.BadgeStreak]

		var quizzes int64
		database.DB.Table("quiz_attempts").
			Where("user_id = ? AND passed = true AND created_at >= ?", s.UserID, since).Count(&quizzes)
		r.Quizzes = int(quizzes)

		// Open loans, and how many of those are late — whole calendar days,
		// via the one definition in desk.go.
		var open []models.Loan
		database.DB.Where("student_id = ? AND return_date IS NULL", s.UserID).Find(&open)
		r.Open = len(open)
		for _, l := range open {
			if overdueDays(l.DueDate, now) > 0 {
				r.Overdue++
			}
		}

		var last time.Time
		database.DB.Model(&models.ReadingLog{}).
			Select("MAX(created_at)").Where("student_id = ?", s.UserID).Scan(&last)
		if !last.IsZero() {
			r.LastSeen = last.Format("2006-01-02")
		}

		totalBooks += r.Books
		totalPages += r.Pages
		totalQuizzes += r.Quizzes
		overdueTotal += r.Overdue
		roster = append(roster, r)
	}

	// Eight weeks of borrowing for the class as a whole.
	weeks := []fiber.Map{}
	if len(ids) > 0 {
		type wk struct {
			Wk time.Time
			N  int
		}
		var rows []wk
		database.DB.Raw(`
			SELECT date_trunc('week', issue_date) AS wk, count(*) AS n
			FROM loans WHERE student_id IN ? AND issue_date >= ?
			GROUP BY 1 ORDER BY 1`, ids, time.Now().AddDate(0, 0, -56)).Scan(&rows)
		for _, r := range rows {
			weeks = append(weeks, fiber.Map{"week": r.Wk.Format("2006-01-02"), "loans": r.N})
		}
	}

	activePct := 0
	if len(students) > 0 {
		activePct = int(float64(activeReaders)/float64(len(students))*100 + 0.5)
	}

	return c.JSON(fiber.Map{
		"class":       fiber.Map{"grade": grade, "class_group": group, "label": strconv.Itoa(grade) + "-" + group},
		"classes":     classes,
		"period_days": days,
		"totals": fiber.Map{
			"readers": len(students), "active_readers": activeReaders, "active_pct": activePct,
			"books": totalBooks, "pages": totalPages, "quizzes": totalQuizzes,
			"overdue": overdueTotal,
		},
		"roster": roster,
		"weeks":  weeks,
	})
}
