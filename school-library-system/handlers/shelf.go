package handlers

import (
	"strconv"
	"strings"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// My Shelf: the reader's own profile screen — stats, badges, currently
// reading, diary, want-to-read and private notes.

/* ----------------------------------------------------------------- shelf */

// GetShelf returns the caller's shelf, optionally filtered by status.
func GetShelf(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	q := database.DB.Preload("Work").Preload("Work.Author").Where("user_id = ?", uid)
	if s := c.Query("status"); s != "" {
		q = q.Where("status = ?", s)
	}
	if c.Query("favorite") == "true" {
		q = q.Where("favorite = true")
	}

	var items []models.ShelfItem
	if err := q.Order("updated_at desc").Find(&items).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load shelf"})
	}

	// Decorate with the edition the reader shelved, so the UI has a cover and a
	// page count without a second round trip.
	out := make([]fiber.Map, 0, len(items))
	for _, it := range items {
		row := fiber.Map{
			"id": it.ID, "work_id": it.WorkID, "status": it.Status, "favorite": it.Favorite,
			"title": it.Work.Title, "author": it.Work.Author.Name,
			"edition_id": it.EditionID, "updated_at": it.UpdatedAt,
		}
		if it.EditionID != nil {
			var ed models.Edition
			if err := database.DB.First(&ed, *it.EditionID).Error; err == nil {
				row["cover_url"] = ed.CoverURL
				row["pages"] = ed.PageCount
				row["cefr"] = ed.CEFRLevel
				if ed.Title != "" {
					row["title"] = ed.Title
				}
			}
		}
		out = append(out, row)
	}
	return c.JSON(out)
}

// SetShelfStatus puts a work on the caller's shelf, moves it between statuses,
// or takes it off entirely when status is empty.
func SetShelfStatus(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		WorkID    uint   `json:"work_id"`
		EditionID *uint  `json:"edition_id"`
		Status    string `json:"status"`
		// Favorite is sent on its own to star a book without changing, or
		// needing, a shelf status.
		Favorite *bool `json:"favorite"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}

	// An edition is enough: resolve its work so the caller does not have to
	// know the difference.
	if req.WorkID == 0 && req.EditionID != nil {
		var ed models.Edition
		if err := database.DB.First(&ed, *req.EditionID).Error; err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Unknown edition"})
		}
		req.WorkID = ed.WorkID
	}
	if req.WorkID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "A work or edition is required"})
	}

	// An empty status with no favorite flag means "take it off my shelf".
	// A starred book stays, because the star is the reason it is there.
	if req.Status == "" && req.Favorite == nil {
		database.DB.Where("user_id = ? AND work_id = ? AND favorite = false", uid, req.WorkID).
			Delete(&models.ShelfItem{})
		database.DB.Model(&models.ShelfItem{}).
			Where("user_id = ? AND work_id = ?", uid, req.WorkID).
			Update("status", "")
		return c.JSON(fiber.Map{"removed": true})
	}
	if req.Status != "" {
		switch req.Status {
		case models.ShelfOwned, models.ShelfWant, models.ShelfReading, models.ShelfRead:
		default:
			return c.Status(400).JSON(fiber.Map{"error": "Unknown shelf status"})
		}
	}

	var item models.ShelfItem
	err = database.DB.Where("user_id = ? AND work_id = ?", uid, req.WorkID).First(&item).Error
	if err == gorm.ErrRecordNotFound {
		item = models.ShelfItem{UserID: uid, WorkID: req.WorkID, EditionID: req.EditionID, Status: req.Status}
		if req.Favorite != nil {
			item.Favorite = *req.Favorite
		}
		if err := database.DB.Create(&item).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not update shelf"})
		}
		return c.JSON(item)
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not update shelf"})
	}

	if req.Status != "" {
		item.Status = req.Status
	}
	if req.Favorite != nil {
		item.Favorite = *req.Favorite
	}
	if req.EditionID != nil {
		item.EditionID = req.EditionID
	}
	database.DB.Save(&item)
	return c.JSON(item)
}

/* ----------------------------------------------------------------- notes */

// GetNotes returns the caller's private notes. Nobody else can read these —
// there is deliberately no endpoint to fetch another reader's notes.
func GetNotes(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	var notes []models.Note
	database.DB.Preload("Work").Preload("Work.Author").
		Where("user_id = ?", uid).Order("updated_at desc").Find(&notes)
	return c.JSON(notes)
}

// SaveNote creates or replaces the caller's note on a work.
func SaveNote(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	var req struct {
		WorkID    uint   `json:"work_id"`
		EditionID *uint  `json:"edition_id"`
		Text      string `json:"text"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}
	if req.WorkID == 0 && req.EditionID != nil {
		var ed models.Edition
		if err := database.DB.First(&ed, *req.EditionID).Error; err == nil {
			req.WorkID = ed.WorkID
		}
	}
	if req.WorkID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "A work or edition is required"})
	}

	var note models.Note
	err = database.DB.Where("user_id = ? AND work_id = ?", uid, req.WorkID).First(&note).Error
	if err == gorm.ErrRecordNotFound {
		note = models.Note{UserID: uid, WorkID: req.WorkID, Text: req.Text}
		database.DB.Create(&note)
		return c.JSON(note)
	}
	note.Text = req.Text
	database.DB.Save(&note)
	return c.JSON(note)
}

// DeleteNote removes one of the caller's own notes.
func DeleteNote(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id := c.Params("id")
	// Scoped by user_id so an id from another reader cannot be deleted.
	res := database.DB.Where("id = ? AND user_id = ?", id, uid).Delete(&models.Note{})
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Note not found"})
	}
	return c.JSON(fiber.Map{"deleted": true})
}

/* ---------------------------------------------------------------- badges */

// BadgeView is a badge plus this reader's standing on it.
type BadgeView struct {
	models.Badge
	Earned   bool       `json:"earned"`
	EarnedAt *time.Time `json:"earned_at"`
	Progress int        `json:"progress"`
	Pinned   bool       `json:"pinned"`
}

// GetBadges returns every badge with the caller's progress, recomputed from
// live data. Anything that has reached its target and is not yet recorded is
// awarded on the spot, so badges cannot silently fall behind reality.
func GetBadges(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var badges []models.Badge
	database.DB.Order("sort asc, id asc").Find(&badges)

	metrics := readerMetrics(uid)

	var earned []models.UserBadge
	database.DB.Where("user_id = ?", uid).Find(&earned)
	earnedBy := map[uint]models.UserBadge{}
	for _, e := range earned {
		earnedBy[e.BadgeID] = e
	}

	out := make([]BadgeView, 0, len(badges))
	for _, b := range badges {
		progress := metrics[b.Metric]
		view := BadgeView{Badge: b, Progress: progress}

		if ub, ok := earnedBy[b.ID]; ok {
			view.Earned = true
			at := ub.EarnedAt
			view.EarnedAt = &at
			view.Pinned = ub.Pinned
		} else if b.Target > 0 && progress >= b.Target {
			// Newly reached — record it so the date is stable from now on.
			ub := models.UserBadge{UserID: uid, BadgeID: b.ID, EarnedAt: time.Now()}
			if err := database.DB.Create(&ub).Error; err == nil {
				view.Earned = true
				at := ub.EarnedAt
				view.EarnedAt = &at
			}
		}
		out = append(out, view)
	}
	return c.JSON(out)
}

// readerMetrics computes every badge metric for one reader in one place.
func readerMetrics(uid uint) map[string]int {
	m := map[string]int{}

	// Pages: the furthest page reached in each book, summed. Summing every log
	// row would count the same pages repeatedly.
	var pages struct{ Total int }
	database.DB.Raw(`
		SELECT COALESCE(SUM(best),0) AS total FROM (
			SELECT MAX(page) AS best FROM reading_logs WHERE student_id = ? GROUP BY loan_id
		) t`, uid).Scan(&pages)
	m[models.BadgePages] = pages.Total

	// Books finished = returned loans.
	var books int64
	database.DB.Model(&models.Loan{}).
		Where("student_id = ? AND return_date IS NOT NULL", uid).Count(&books)
	m[models.BadgeBooks] = int(books)

	// Distinct languages finished.
	var langs int64
	database.DB.Model(&models.Loan{}).
		Distinct("editions.language_key").
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Joins("JOIN editions ON editions.id = books.edition_id").
		Where("loans.student_id = ? AND loans.return_date IS NOT NULL AND editions.language_key <> ''", uid).
		Count(&langs)
	m[models.BadgeLangs] = int(langs)

	// Returned before the due date.
	var early int64
	database.DB.Model(&models.Loan{}).
		Where("student_id = ? AND return_date IS NOT NULL AND return_date < due_date", uid).Count(&early)
	m[models.BadgeEarlyRet] = int(early)

	// Quizzes passed, counted once per book.
	var quizzes int64
	database.DB.Model(&models.ChallengeProgress{}).
		Where("user_id = ? AND quiz_best >= 2", uid).Count(&quizzes)
	m[models.BadgeQuizzes] = int(quizzes)

	m[models.BadgeStreak] = readingStreak(uid)
	return m
}

// readingStreak counts consecutive days ending today or yesterday that have a
// diary entry — the same rule the header pill uses.
func readingStreak(uid uint) int {
	var days []time.Time
	database.DB.Model(&models.ReadingLog{}).
		Where("student_id = ?", uid).
		Order("created_at desc").
		Pluck("created_at", &days)
	if len(days) == 0 {
		return 0
	}

	seen := map[string]bool{}
	key := func(t time.Time) string { return t.Format("2006-01-02") }
	for _, d := range days {
		seen[key(d)] = true
	}

	cursor := time.Now()
	if !seen[key(cursor)] {
		cursor = cursor.AddDate(0, 0, -1)
		if !seen[key(cursor)] {
			return 0
		}
	}
	n := 0
	for seen[key(cursor)] {
		n++
		cursor = cursor.AddDate(0, 0, -1)
	}
	return n
}

// GetShelfSummary backs the profile banner: the four headline stats plus the
// streak, all derived rather than stored.
func GetShelfSummary(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	m := readerMetrics(uid)

	// Average reading speed in pages per day, across books with at least two
	// diary entries so there is an interval to measure.
	var speed struct{ Pages, Days float64 }
	database.DB.Raw(`
		SELECT COALESCE(SUM(pages),0) AS pages, COALESCE(SUM(days),0) AS days FROM (
			SELECT MAX(page) - MIN(page) AS pages,
			       GREATEST(EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 86400.0, 0.5) AS days
			FROM reading_logs WHERE student_id = ? GROUP BY loan_id HAVING COUNT(*) > 1
		) t`, uid).Scan(&speed)
	pagesPerDay := 0.0
	if speed.Days > 0 {
		pagesPerDay = speed.Pages / speed.Days
	}

	var counts struct{ Owned, Want, Favorite int64 }
	database.DB.Model(&models.ShelfItem{}).Where("user_id = ? AND status = ?", uid, models.ShelfOwned).Count(&counts.Owned)
	database.DB.Model(&models.ShelfItem{}).Where("user_id = ? AND status = ?", uid, models.ShelfWant).Count(&counts.Want)
	database.DB.Model(&models.ShelfItem{}).Where("user_id = ? AND favorite = true", uid).Count(&counts.Favorite)

	var activeLoans int64
	database.DB.Model(&models.Loan{}).Where("student_id = ? AND return_date IS NULL", uid).Count(&activeLoans)

	var notes int64
	database.DB.Model(&models.Note{}).Where("user_id = ?", uid).Count(&notes)

	return c.JSON(fiber.Map{
		"books_completed": m[models.BadgeBooks],
		"pages_read":      m[models.BadgePages],
		"streak_days":     m[models.BadgeStreak],
		"pages_per_day":   round1(pagesPerDay),
		"languages":       m[models.BadgeLangs],
		"active_loans":    activeLoans,
		"want_to_read":    counts.Want,
		"owned":           counts.Owned,
		"favorites":       counts.Favorite,
		"notes":           notes,

		// The second line under each statistic in the design's banner: the
		// month's gain, when the reader started, how they sit in their year
		// group, and the streak to beat.
		"books_this_month": booksThisMonth(uid),
		"member_since":     memberSince(uid),
		"grade_percentile": gradePercentile(uid),
		"best_streak":      bestStreak(uid),

		// The sidebar's genre mix, over the books they have finished.
		"genre_mix": genreMix(uid),

		// The profile banner's pills.
		"reading_level": readingLevel(uid),
	})
}

// booksThisMonth counts loans returned since the first of the current month.
func booksThisMonth(uid uint) int {
	now := time.Now()
	from := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	var n int64
	database.DB.Model(&models.Loan{}).
		Where("student_id = ? AND return_date IS NOT NULL AND return_date >= ?", uid, from).
		Count(&n)
	return int(n)
}

// memberSince is when this reader started — the design's "since September
// 2025". User rows carry no creation date, so it is the earliest sign of
// activity: their first loan, or failing that their first shelf entry.
func memberSince(uid uint) *time.Time {
	var loan models.Loan
	if err := database.DB.Where("student_id = ?", uid).
		Order("issue_date").First(&loan).Error; err == nil && !loan.IssueDate.IsZero() {
		return &loan.IssueDate
	}
	var item models.ShelfItem
	if err := database.DB.Where("user_id = ?", uid).
		Order("created_at").First(&item).Error; err == nil && !item.CreatedAt.IsZero() {
		return &item.CreatedAt
	}
	return nil
}

// bestStreak is the longest run of consecutive days with a diary entry, ever —
// the "best: 31 days" line beside the current streak.
func bestStreak(uid uint) int {
	var days []time.Time
	database.DB.Model(&models.ReadingLog{}).
		Where("student_id = ?", uid).Order("created_at").Pluck("created_at", &days)

	best, run := 0, 0
	var prev string
	for _, d := range days {
		key := d.Format("2006-01-02")
		if key == prev {
			continue // several entries on one day are still one day
		}
		if prev != "" {
			if p, err := time.Parse("2006-01-02", prev); err == nil &&
				p.AddDate(0, 0, 1).Format("2006-01-02") == key {
				run++
			} else {
				run = 1
			}
		} else {
			run = 1
		}
		if run > best {
			best = run
		}
		prev = key
	}
	return best
}

// gradePercentile places the reader among the students in their own year group
// and branch by pages read — the design's "top 15% of Grade 9". It returns 0
// when there is nobody to compare against, and the caller omits the line.
func gradePercentile(uid uint) int {
	var me models.Student
	if err := database.DB.Where("user_id = ?", uid).First(&me).Error; err != nil {
		return 0
	}

	var peers []models.Student
	database.DB.Where("grade = ? AND branch_id = ?", me.Grade, me.BranchID).Find(&peers)
	if len(peers) < 2 {
		return 0
	}

	mine := readerMetrics(uid)[models.BadgePages]
	ahead := 0
	for _, p := range peers {
		if p.UserID == uid {
			continue
		}
		if readerMetrics(p.UserID)[models.BadgePages] > mine {
			ahead++
		}
	}
	// "Top N%": 1 means nobody is ahead.
	pct := int(float64(ahead+1) / float64(len(peers)) * 100)
	if pct < 1 {
		pct = 1
	}
	return pct
}

// genreMix is the share of each genre among the books the reader has finished.
// Genre is a branch-local shelving decision recorded on the holding, so it
// comes off the book that was actually lent.
func genreMix(uid uint) []fiber.Map {
	type row struct {
		Name string
		N    int
	}
	var rows []row
	database.DB.Model(&models.Loan{}).
		Select("COALESCE(genres.name, '') as name, count(*) as n").
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Joins("LEFT JOIN genres ON genres.id = books.genre_id").
		Where("loans.student_id = ? AND loans.return_date IS NOT NULL", uid).
		Group("genres.name").Order("n desc").Scan(&rows)

	total := 0
	for _, r := range rows {
		total += r.N
	}
	out := make([]fiber.Map, 0, len(rows))
	for _, r := range rows {
		if r.Name == "" || total == 0 {
			continue
		}
		out = append(out, fiber.Map{
			"name": r.Name, "books": r.N,
			"pct": int(float64(r.N)/float64(total)*100 + 0.5),
		})
	}
	return out
}

func round1(f float64) float64 {
	return float64(int(f*10+0.5)) / 10
}

// PinBadge toggles whether a badge shows on the profile banner. The design
// pins three; this enforces that cap.
func PinBadge(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var ub models.UserBadge
	if err := database.DB.Where("user_id = ? AND badge_id = ?", uid, id).First(&ub).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Badge not earned"})
	}

	if !ub.Pinned {
		var pinned int64
		database.DB.Model(&models.UserBadge{}).Where("user_id = ? AND pinned = true", uid).Count(&pinned)
		if pinned >= 3 {
			return c.Status(400).JSON(fiber.Map{
				"error": "Three badges are already pinned", "code": "PIN_LIMIT",
			})
		}
	}
	ub.Pinned = !ub.Pinned
	database.DB.Save(&ub)
	return c.JSON(ub)
}

/* ------------------------------------------------------------ year goal */

// GetReadingGoal returns the caller's goal for a year (this year by default)
// together with what they have finished so far, which is what the card on the
// shelf needs to draw its bar. A reader who has not set one gets target 0 and
// the card invites them to.
func GetReadingGoal(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	year := time.Now().Year()
	if y, err := strconv.Atoi(c.Query("year")); err == nil && y > 2000 {
		year = y
	}

	var goal models.ReadingGoal
	database.DB.Where("user_id = ? AND year = ?", uid, year).First(&goal)

	from := time.Date(year, 1, 1, 0, 0, 0, 0, time.Local)
	to := from.AddDate(1, 0, 0)
	var done int64
	database.DB.Model(&models.Loan{}).
		Where("student_id = ? AND return_date IS NOT NULL AND return_date >= ? AND return_date < ?",
			uid, from, to).
		Count(&done)

	// Weeks left in the year, so the card can say how much pace is needed.
	weeksLeft := int(to.Sub(time.Now()).Hours() / 24 / 7)
	if weeksLeft < 0 {
		weeksLeft = 0
	}

	return c.JSON(fiber.Map{
		"year": year, "target": goal.Target, "completed": done, "weeks_left": weeksLeft,
	})
}

// SetReadingGoal creates or updates the caller's goal for a year. A target of
// zero clears it.
func SetReadingGoal(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Year   int `json:"year"`
		Target int `json:"target"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Year <= 2000 {
		req.Year = time.Now().Year()
	}
	if req.Target < 0 || req.Target > 1000 {
		return c.Status(400).JSON(fiber.Map{
			"error": "A yearly goal must be between 0 and 1000 books", "code": "BAD_TARGET",
		})
	}

	var goal models.ReadingGoal
	err = database.DB.Where("user_id = ? AND year = ?", uid, req.Year).First(&goal).Error
	if err == gorm.ErrRecordNotFound {
		goal = models.ReadingGoal{UserID: uid, Year: req.Year, Target: req.Target}
		if err := database.DB.Create(&goal).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not save the goal"})
		}
	} else {
		goal.Target = req.Target
		database.DB.Save(&goal)
	}
	return c.JSON(goal)
}

// SetBio updates the one line a reader writes about themselves on their own
// profile. It is deliberately not part of UpdateProfile: that endpoint gates
// every change behind the current password, which is right for an email or a
// password change and absurd for a sentence about liking science fiction.
func SetBio(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Bio string `json:"bio"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid input"})
	}
	if len([]rune(req.Bio)) > 280 {
		return c.Status(400).JSON(fiber.Map{
			"error": "A bio is at most 280 characters", "code": "TOO_LONG",
		})
	}

	if err := database.DB.Model(&models.Student{}).
		Where("user_id = ?", uid).Update("bio", strings.TrimSpace(req.Bio)).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save"})
	}
	return c.JSON(fiber.Map{"bio": strings.TrimSpace(req.Bio)})
}

// readingLevel is the CEFR level the reader actually reads at: the commonest
// level among the books they have finished. The design shows it as a pill on
// the profile; students have no CEFR field of their own, and guessing one from
// their year group would be fiction.
func readingLevel(uid uint) string {
	type row struct {
		Level string
		N     int
	}
	var rows []row
	database.DB.Model(&models.Loan{}).
		Select("editions.cefr_level as level, count(*) as n").
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Joins("JOIN editions ON editions.id = books.edition_id").
		Where("loans.student_id = ? AND loans.return_date IS NOT NULL AND editions.cefr_level <> ''", uid).
		Group("editions.cefr_level").Order("n desc").Limit(1).Scan(&rows)
	if len(rows) == 0 {
		return ""
	}
	return rows[0].Level
}
