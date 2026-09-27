package handlers

import (
	"strconv"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// Endpoints behind the myredbookshelf landing page and Discover hub.
//
// Everything here is derived from data the library already records — loans and
// the reading diary — rather than from a social layer that does not exist yet.
// Where the design asks for something only reviews can provide, the endpoint
// says so instead of inventing it.

// PublicBook is a catalogue entry safe to show a logged-out visitor: the book
// itself, never who borrowed it.
type PublicBook struct {
	EditionID uint   `json:"edition_id"`
	WorkID    uint   `json:"work_id"`
	Title     string `json:"title"`
	Author    string `json:"author"`
	Genre     string `json:"genre"`
	CEFR      string `json:"cefr"`
	CoverURL  string `json:"cover_url"`
	Pages     int    `json:"pages"`
	Year      int    `json:"year"`
	// Loans is how many times the book has been borrowed. The design calls this
	// "logs" on the trending card.
	Loans int `json:"loans"`

	Rating       *float64 `json:"rating"`
	RatingsCount int      `json:"ratings_count"`

	// Availability at the caller's own branch, so the trending card can offer
	// the same reserve action as the catalogue.
	BookID          *uint  `json:"book_id,omitempty"`
	AvailableCopies int    `json:"available_copies"`
	MyStatus        string `json:"my_status"`
}

// GetPublicBooks backs "What the community is reading" on the landing page.
// No auth, no personal data: counts and bibliographic facts only.
func GetPublicBooks(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "8"))
	if limit <= 0 || limit > 40 {
		limit = 8
	}

	books, err := popularBooks(limit, time.Time{})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load books"})
	}
	return c.JSON(books)
}

// GetTrending backs the Discover carousel: the most borrowed titles in a recent
// window, falling back to all time when the window is empty.
//
// It also reports availability at the caller's own branch and whatever they are
// already doing with the book, so the card's reserve button follows the same
// rule as the catalogue instead of offering an action that cannot work.
func GetTrending(c *fiber.Ctx) error {
	days, _ := strconv.Atoi(c.Query("days", "30"))
	if days <= 0 || days > 365 {
		days = 30
	}
	limit, _ := strconv.Atoi(c.Query("limit", "9"))
	if limit <= 0 || limit > 40 {
		limit = 9
	}

	since := time.Now().AddDate(0, 0, -days)
	books, err := popularBooks(limit, since)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load trending"})
	}
	// popularBooks pads its result with never-borrowed titles so the carousel is
	// never short, which means length alone cannot tell us whether the window
	// actually found any loans. Check for a real signal instead: if nothing in
	// the window was borrowed, rank by all time rather than showing a "trending"
	// row where every book says it has never been borrowed.
	if !anyBorrowed(books) {
		if all, err := popularBooks(limit, time.Time{}); err == nil && anyBorrowed(all) {
			books = all
		}
	}

	decorateAvailability(c, books)
	return c.JSON(books)
}

// decorateAvailability fills in the caller's branch holding, free copies and
// their own hold state for each trending book.
func decorateAvailability(c *fiber.Ctx, books []PublicBook) {
	branchID, err := getUserBranchID(c)
	if err != nil || len(books) == 0 {
		return
	}
	uid, _ := currentUserID(c)

	ids := make([]uint, 0, len(books))
	for _, b := range books {
		ids = append(ids, b.EditionID)
	}

	var holdings []models.Book
	database.DB.Preload("Copies").Preload("Copies.Status").
		Where("branch_id = ? AND edition_id IN ?", branchID, ids).Find(&holdings)

	byEdition := map[uint]*models.Book{}
	for i := range holdings {
		if holdings[i].EditionID != nil {
			byEdition[*holdings[i].EditionID] = &holdings[i]
		}
	}

	// The reader's open loans and holds, keyed by the branch holding.
	state := map[uint]string{}
	if uid != 0 {
		var loans []models.Loan
		database.DB.Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
			Where("loans.student_id = ? AND loans.return_date IS NULL", uid).
			Preload("BookCopy").Find(&loans)
		for _, l := range loans {
			state[l.BookCopy.BookID] = "ON_LOAN"
		}
		var res []models.Reservation
		database.DB.Joins("JOIN reservation_statuses ON reservation_statuses.id = reservations.status_id").
			Where("reservations.student_id = ? AND reservation_statuses.code IN ?",
				uid, []string{"PENDING", "APPROVED"}).
			Preload("Status").Preload("BookCopy").Find(&res)
		for _, r := range res {
			if state[r.BookCopy.BookID] == "ON_LOAN" {
				continue
			}
			if r.Status.Code == "APPROVED" {
				state[r.BookCopy.BookID] = "RESERVED_READY"
			} else {
				state[r.BookCopy.BookID] = "RESERVED_PENDING"
			}
		}
	}

	// Availability has to mean the same thing here as on the catalogue, or
	// Discover offers a book the catalogue knows is spoken for.
	claimed := claimedCopyIDs()

	for i := range books {
		h, ok := byEdition[books[i].EditionID]
		if !ok {
			continue
		}
		id := h.ID
		books[i].BookID = &id
		for _, cp := range h.Copies {
			if cp.Status.Code == "AVAILABLE" && !claimed[cp.ID] {
				books[i].AvailableCopies++
			}
		}
		books[i].MyStatus = state[h.ID]
	}
}

func anyBorrowed(books []PublicBook) bool {
	for _, b := range books {
		if b.Loans > 0 {
			return true
		}
	}
	return false
}

// popularBooks ranks editions by how often they have been loaned. A zero
// `since` means all time.
func popularBooks(limit int, since time.Time) ([]PublicBook, error) {
	type row struct {
		EditionID uint
		N         int
	}
	var rows []row

	q := database.DB.Model(&models.Loan{}).
		Select("books.edition_id as edition_id, count(*) as n").
		Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
		Joins("JOIN books ON books.id = book_copies.book_id").
		Where("books.edition_id IS NOT NULL")
	if !since.IsZero() {
		q = q.Where("loans.issue_date >= ?", since)
	}
	if err := q.Group("books.edition_id").Order("n DESC").Limit(limit).Scan(&rows).Error; err != nil {
		return nil, err
	}

	// Pad with never-borrowed titles so a young library still fills the shelf.
	ids := make([]uint, 0, limit)
	loansBy := map[uint]int{}
	for _, r := range rows {
		ids = append(ids, r.EditionID)
		loansBy[r.EditionID] = r.N
	}
	if len(ids) < limit {
		var extra []models.Edition
		q := database.DB.Where("merged_into_id IS NULL")
		if len(ids) > 0 {
			q = q.Where("id NOT IN ?", ids)
		}
		q.Limit(limit - len(ids)).Find(&extra)
		for _, e := range extra {
			ids = append(ids, e.ID)
		}
	}
	if len(ids) == 0 {
		return []PublicBook{}, nil
	}

	var editions []models.Edition
	if err := database.DB.Preload("Work").Preload("Work.Author").
		Where("id IN ?", ids).Find(&editions).Error; err != nil {
		return nil, err
	}

	// Genre lives on the branch holding, not the shared edition; take whichever
	// branch has classified it.
	genreBy := map[uint]string{}
	coverBy := map[uint]string{}
	var holdings []models.Book
	database.DB.Preload("Genre").Where("edition_id IN ?", ids).Find(&holdings)
	for _, h := range holdings {
		if h.EditionID == nil {
			continue
		}
		if _, ok := genreBy[*h.EditionID]; !ok && h.Genre.Name != "" {
			genreBy[*h.EditionID] = h.Genre.Name
		}
		if _, ok := coverBy[*h.EditionID]; !ok && h.CoverURL != "" {
			coverBy[*h.EditionID] = h.CoverURL
		}
	}

	byID := map[uint]models.Edition{}
	for _, e := range editions {
		byID[e.ID] = e
	}

	// Ratings per work, in one query.
	workIDs := make([]uint, 0, len(editions))
	for _, e := range editions {
		workIDs = append(workIDs, e.WorkID)
	}
	type ratingRow struct {
		WorkID uint
		Avg    float64
		N      int
	}
	var rrows []ratingRow
	database.DB.Model(&models.Review{}).
		Select("work_id as work_id, AVG(rating) as avg, COUNT(*) as n").
		Where("work_id IN ? AND hidden = false", workIDs).
		Group("work_id").Scan(&rrows)
	ratingBy := map[uint]ratingRow{}
	for _, r := range rrows {
		ratingBy[r.WorkID] = r
	}

	out := make([]PublicBook, 0, len(ids))
	for _, id := range ids {
		e, ok := byID[id]
		if !ok {
			continue
		}
		title := e.Title
		if title == "" {
			title = e.Work.Title
		}
		cover := e.CoverURL
		if cover == "" {
			cover = coverBy[id]
		}
		pb := PublicBook{
			EditionID: e.ID, WorkID: e.WorkID, Title: title,
			Author: e.Work.Author.Name, Genre: genreBy[id], CEFR: e.CEFRLevel,
			CoverURL: cover, Pages: e.PageCount, Year: e.PublicationYear,
			Loans: loansBy[id],
		}
		if r, ok := ratingBy[e.WorkID]; ok && r.N > 0 {
			avg := float64(int(r.Avg*10+0.5)) / 10
			pb.Rating = &avg
			pb.RatingsCount = r.N
		}
		out = append(out, pb)
	}
	return out, nil
}

/* ------------------------------------------------------------ leaderboards */

// Reader is one row of a leaderboard.
type Reader struct {
	UserID   uint   `json:"user_id"`
	Name     string `json:"name"`
	Grade    string `json:"grade"`
	Branch   string `json:"branch"`
	Pages    int    `json:"pages"`
	Books    int    `json:"books"`
	IsMe     bool   `json:"is_me"`
	Initials string `json:"initials"`

	// Favourite is this reader's best-rated recent read, which the Bookworm
	// card shows as a tilted cover beside their name.
	Favourite *FavouriteRead `json:"favourite,omitempty"`
}

// FavouriteRead is the book shown on the Bookworm card.
type FavouriteRead struct {
	EditionID uint     `json:"edition_id"`
	Title     string   `json:"title"`
	Author    string   `json:"author"`
	CoverURL  string   `json:"cover_url"`
	Rating    *float64 `json:"rating"`
}

// GetTopReaders backs the Discover sidebar and "Bookworm of the Month".
// Scoped to the caller's own school — never across schools, since that would
// need the alliance data-sharing agreement the design describes.
func GetTopReaders(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school for this account"})
	}

	days, _ := strconv.Atoi(c.Query("days", "30"))
	if days <= 0 || days > 3650 {
		days = 30
	}
	limit, _ := strconv.Atoi(c.Query("limit", "5"))
	if limit <= 0 || limit > 50 {
		limit = 5
	}
	since := time.Now().AddDate(0, 0, -days)

	readers, err := readersBySchool(schoolID, since, uid)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load readers"})
	}

	// A library that has been quiet this month should not show an empty board:
	// widen to all time and say that is what happened, rather than implying
	// nobody reads here.
	fallback := false
	if len(readers) == 0 {
		if all, err := readersBySchool(schoolID, time.Time{}, uid); err == nil && len(all) > 0 {
			readers, fallback = all, true
		}
	}
	if len(readers) > limit {
		readers = readers[:limit]
	}
	// Only the leader's favourite is shown, so only that one is looked up.
	if len(readers) > 0 {
		readers[0].Favourite = favouriteRead(readers[0].UserID)
	}
	return c.JSON(fiber.Map{"readers": readers, "all_time": fallback})
}

// LeagueRow is one branch in the branch league.
type LeagueRow struct {
	Branch   string `json:"branch"`
	Students int    `json:"students"`
	Pages    int    `json:"pages"`
	// AvgPages is pages per student — the metric the design specifies, so a
	// large branch does not simply out-read a small one.
	AvgPages int  `json:"avg_pages"`
	IsMine   bool `json:"is_mine"`
}

// GetLeague backs the league widget on Discover.
//
// scope=branches ranks the branches of the caller's own school; scope=schools
// ranks whole schools, which is what the design's "Alliance schools" toggle
// shows. Both use average pages per student so a big branch does not simply
// out-read a small one.
//
// Cross-school rows carry no personal data — a school name and an average —
// which is the only thing shareable before the alliance agreements in Phase 3
// exist.
func GetLeague(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school for this account"})
	}
	myBranch, _ := getUserBranchID(c)
	scope := c.Query("scope", "branches")

	days, _ := strconv.Atoi(c.Query("days", "30"))
	if days <= 0 || days > 3650 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days)

	rows := make([]LeagueRow, 0, 8)

	if scope == "schools" {
		var schools []models.School
		if err := database.DB.Find(&schools).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not load league"})
		}
		for _, sc := range schools {
			var students int64
			database.DB.Model(&models.Student{}).
				Joins("JOIN branches ON branches.id = students.branch_id").
				Where("branches.school_id = ?", sc.ID).Count(&students)

			var pages struct{ Total int }
			database.DB.Model(&models.ReadingLog{}).
				Select("COALESCE(SUM(reading_logs.page),0) as total").
				Joins("JOIN students ON students.user_id = reading_logs.student_id").
				Joins("JOIN branches ON branches.id = students.branch_id").
				Where("branches.school_id = ? AND reading_logs.created_at >= ?", sc.ID, since).
				Scan(&pages)

			avg := 0
			if students > 0 {
				avg = pages.Total / int(students)
			}
			rows = append(rows, LeagueRow{
				Branch: sc.Name, Students: int(students), Pages: pages.Total,
				AvgPages: avg, IsMine: sc.ID == schoolID,
			})
		}
	} else {
		var branches []models.Branch
		if err := database.DB.Where("school_id = ?", schoolID).Find(&branches).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not load league"})
		}
		for _, b := range branches {
			var students int64
			database.DB.Model(&models.Student{}).Where("branch_id = ?", b.ID).Count(&students)

			var pages struct{ Total int }
			database.DB.Model(&models.ReadingLog{}).
				Select("COALESCE(SUM(reading_logs.page),0) as total").
				Joins("JOIN students ON students.user_id = reading_logs.student_id").
				Where("students.branch_id = ? AND reading_logs.created_at >= ?", b.ID, since).
				Scan(&pages)

			avg := 0
			if students > 0 {
				avg = pages.Total / int(students)
			}
			rows = append(rows, LeagueRow{
				Branch: b.Name, Students: int(students), Pages: pages.Total,
				AvgPages: avg, IsMine: b.ID == myBranch,
			})
		}
	}

	// Same reasoning as the readers board: an all-zero league is worse than
	// showing the all-time standings and labelling them.
	allZero := true
	for _, r := range rows {
		if r.Pages > 0 {
			allZero = false
			break
		}
	}
	fallback := false
	if allZero {
		for i := range rows {
			var pages struct{ Total int }
			database.DB.Model(&models.ReadingLog{}).
				Select("COALESCE(SUM(reading_logs.page),0) as total").
				Joins("JOIN students ON students.user_id = reading_logs.student_id").
				Joins("JOIN branches ON branches.id = students.branch_id").
				Where("branches.school_id = ? AND branches.name = ?", schoolID, rows[i].Branch).
				Scan(&pages)
			rows[i].Pages = pages.Total
			if rows[i].Students > 0 {
				rows[i].AvgPages = pages.Total / rows[i].Students
			}
			if pages.Total > 0 {
				fallback = true
			}
		}
	}

	// Highest average first.
	for i := 1; i < len(rows); i++ {
		for j := i; j > 0 && rows[j].AvgPages > rows[j-1].AvgPages; j-- {
			rows[j], rows[j-1] = rows[j-1], rows[j]
		}
	}
	// The reader's own pages, for the "Your contribution" line.
	mine := 0
	if uid, err := currentUserID(c); err == nil {
		var p struct{ Total int }
		database.DB.Raw(`
			SELECT COALESCE(SUM(best),0) AS total FROM (
				SELECT MAX(page) AS best FROM reading_logs
				WHERE student_id = ? AND created_at >= ? GROUP BY loan_id
			) t`, uid, since).Scan(&p)
		if p.Total == 0 && fallback {
			database.DB.Raw(`
				SELECT COALESCE(SUM(best),0) AS total FROM (
					SELECT MAX(page) AS best FROM reading_logs WHERE student_id = ? GROUP BY loan_id
				) t`, uid).Scan(&p)
		}
		mine = p.Total
	}

	var branchCount int64
	database.DB.Model(&models.Branch{}).Where("school_id = ?", schoolID).Count(&branchCount)

	return c.JSON(fiber.Map{
		"league": rows, "all_time": fallback, "scope": scope,
		"my_pages": mine, "branch_count": branchCount,
	})
}

// readersBySchool totals diary pages per student across a school.
func readersBySchool(schoolID uint, since time.Time, me uint) ([]Reader, error) {
	type row struct {
		UserID uint
		Name   string
		Grade  int
		Class  string
		Branch string
		Pages  int
		Books  int
	}
	var rows []row

	err := database.DB.Model(&models.ReadingLog{}).
		Select(`students.user_id as user_id,
		        students.name as name,
		        students.grade as grade,
		        students.class_group as class,
		        branches.name as branch,
		        COALESCE(SUM(reading_logs.page),0) as pages,
		        COUNT(DISTINCT reading_logs.loan_id) as books`).
		Joins("JOIN students ON students.user_id = reading_logs.student_id").
		Joins("JOIN branches ON branches.id = students.branch_id").
		Where("branches.school_id = ? AND reading_logs.created_at >= ?", schoolID, since).
		Group("students.user_id, students.name, students.grade, students.class_group, branches.name").
		Order("pages DESC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	out := make([]Reader, 0, len(rows))
	for _, r := range rows {
		grade := ""
		if r.Grade > 0 {
			grade = strconv.Itoa(r.Grade)
			if r.Class != "" {
				grade += "-" + r.Class
			}
		}
		out = append(out, Reader{
			UserID: r.UserID, Name: r.Name, Grade: grade, Branch: r.Branch,
			Pages: r.Pages, Books: r.Books, IsMe: r.UserID == me,
			Initials: initialsOf(r.Name),
		})
	}
	return out, nil
}

// favouriteRead picks the reader's highest-rated review, falling back to the
// most recently returned book when they have not reviewed anything.
func favouriteRead(uid uint) *FavouriteRead {
	var rev models.Review
	if err := database.DB.Where("user_id = ? AND hidden = false", uid).
		Order("rating desc, created_at desc").First(&rev).Error; err == nil {
		var ed models.Edition
		q := database.DB.Preload("Work").Preload("Work.Author")
		var found bool
		if rev.EditionID != nil {
			found = q.First(&ed, *rev.EditionID).Error == nil
		}
		if !found {
			found = q.Where("work_id = ?", rev.WorkID).First(&ed).Error == nil
		}
		if found {
			r := rev.Rating
			return &FavouriteRead{
				EditionID: ed.ID, Title: pick(ed.Title, ed.Work.Title),
				Author: ed.Work.Author.Name, CoverURL: coverFor(ed), Rating: &r,
			}
		}
	}

	var loan models.Loan
	if err := database.DB.
		Preload("BookCopy").Preload("BookCopy.Book").Preload("BookCopy.Book.Author").
		Where("student_id = ? AND return_date IS NOT NULL", uid).
		Order("return_date desc").First(&loan).Error; err == nil {
		b := loan.BookCopy.Book
		f := &FavouriteRead{Title: b.Title, Author: b.Author.Name, CoverURL: b.CoverURL}
		if b.EditionID != nil {
			f.EditionID = *b.EditionID
		}
		return f
	}
	return nil
}

func pick(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// coverFor falls back to a branch holding's cover when the shared edition has
// none of its own.
func coverFor(ed models.Edition) string {
	if ed.CoverURL != "" {
		return ed.CoverURL
	}
	var h models.Book
	if database.DB.Where("edition_id = ? AND cover_url <> ''", ed.ID).First(&h).Error == nil {
		return h.CoverURL
	}
	return ""
}

func initialsOf(name string) string {
	out := ""
	word := true
	for _, r := range name {
		if r == ' ' {
			word = true
			continue
		}
		if word {
			out += string(r)
			word = false
			if len(out) >= 2 {
				break
			}
		}
	}
	return out
}

// callerSchoolID resolves the school of whoever is calling, whatever their role.
func callerSchoolID(c *fiber.Ctx) (uint, error) {
	uid, err := currentUserID(c)
	if err != nil {
		return 0, err
	}
	var stu models.Student
	if err := database.DB.Preload("Branch").Where("user_id = ?", uid).First(&stu).Error; err == nil {
		return stu.Branch.SchoolID, nil
	}
	var lib models.Librarian
	if err := database.DB.Where("user_id = ?", uid).First(&lib).Error; err == nil {
		return lib.SchoolID, nil
	}
	var mgr models.Manager
	if err := database.DB.Where("user_id = ?", uid).First(&mgr).Error; err == nil {
		return mgr.SchoolID, nil
	}
	// An admin has no school of their own; show them the first one.
	var b models.Branch
	if err := database.DB.Order("school_id asc").First(&b).Error; err == nil {
		return b.SchoolID, nil
	}
	return 0, fiber.NewError(fiber.StatusForbidden, "No school")
}

// GetPublicChallenge backs the "open challenge" card on the landing page: the
// challenge running right now, or the next one due to start.
//
// It is deliberately thin. A guest sees what the challenge is and how many
// people are in it — never who they are, never anyone's progress.
func GetPublicChallenge(c *fiber.Ctx) error {
	now := time.Now()

	var ch models.Challenge
	err := database.DB.
		Preload("Books").Preload("Books.Edition").
		Where("starts_at <= ? AND ends_at >= ?", now, now).
		Order("ends_at").First(&ch).Error
	if err != nil {
		// Nothing running: offer the next one instead.
		err = database.DB.
			Preload("Books").Preload("Books.Edition").
			Where("starts_at > ?", now).
			Order("starts_at").First(&ch).Error
	}
	if err != nil {
		return c.JSON(fiber.Map{"found": false})
	}

	var participants int64
	database.DB.Model(&models.ChallengeParticipant{}).
		Where("challenge_id = ?", ch.ID).Count(&participants)

	covers := make([]string, 0, len(ch.Books))
	for _, b := range ch.Books {
		covers = append(covers, b.Edition.CoverURL)
	}

	return c.JSON(fiber.Map{
		"found": true,
		"title": ch.Title, "description": ch.Description,
		"starts_at": ch.StartsAt, "ends_at": ch.EndsAt,
		"days_left":    int(ch.EndsAt.Sub(now).Hours() / 24),
		"participants": participants, "book_count": len(ch.Books), "covers": covers,
	})
}

// GetPublicChallenges backs the landing page's "reading together" card: the
// challenges running at partner schools. A guest sees what is being read and
// how many people are in it, never who they are.
func GetPublicChallenges(c *fiber.Ctx) error {
	now := time.Now()

	var list []models.Challenge
	database.DB.
		Preload("Books").Preload("Books.Edition").Preload("School").
		Where("ends_at >= ?", now).
		Order("starts_at").Limit(4).Find(&list)

	out := make([]fiber.Map, 0, len(list))
	for _, ch := range list {
		var participants int64
		database.DB.Model(&models.ChallengeParticipant{}).
			Where("challenge_id = ?", ch.ID).Count(&participants)

		title, cover := "", ""
		if len(ch.Books) > 0 {
			title = ch.Books[0].Edition.Title
			for _, b := range ch.Books {
				if b.Edition.CoverURL != "" {
					cover = b.Edition.CoverURL
					break
				}
			}
		}
		out = append(out, fiber.Map{
			"id": ch.ID, "title": ch.Title, "school": ch.School.Name,
			"participants": participants, "book_count": len(ch.Books),
			"reading": title, "cover_url": cover,
			"starts_at": ch.StartsAt, "ends_at": ch.EndsAt,
			"upcoming": now.Before(ch.StartsAt),
		})
	}
	return c.JSON(out)
}
