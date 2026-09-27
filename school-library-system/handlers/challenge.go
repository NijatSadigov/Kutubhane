package handlers

import (
	"sort"
	"strconv"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Reading challenges: quiz-verified, school-scoped, scored read +10 /
// quiz +15 / review +5 as the design specifies.
//
// Reviews do not exist yet, so the review step is reported as unavailable
// rather than being silently scored as zero.

const quizPassMark = 2 // of 3, per the design

/* ------------------------------------------------------------- listing */

// ListChallenges returns the challenges visible to the caller's school, each
// with the caller's own progress summary.
func ListChallenges(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school for this account"})
	}

	var list []models.Challenge
	if err := database.DB.
		Preload("Books").Preload("Books.Edition").Preload("Books.Edition.Work").
		Preload("Books.Edition.Work.Author").
		Where("school_id = ?", schoolID).
		Order("starts_at desc").Find(&list).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load challenges"})
	}

	out := make([]fiber.Map, 0, len(list))
	for _, ch := range list {
		out = append(out, challengeSummary(ch, uid))
	}
	return c.JSON(out)
}

// GetChallenge returns one challenge in full: its books, the caller's
// per-book progress, the standings and the caller's points.
func GetChallenge(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var ch models.Challenge
	if err := database.DB.
		Preload("Books").Preload("Books.Edition").Preload("Books.Edition.Work").
		Preload("Books.Edition.Work.Author").
		First(&ch, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Challenge not found"})
	}
	// A challenge belongs to a school; never leak another school's.
	if ch.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your school's challenge"})
	}

	progress := progressMap(ch.ID, uid)

	books := make([]fiber.Map, 0, len(ch.Books))
	for _, b := range ch.Books {
		p := progress[b.EditionID]
		var questions int64
		database.DB.Model(&models.QuizQuestion{}).
			Where("challenge_id = ? AND edition_id = ?", ch.ID, b.EditionID).Count(&questions)

		title := b.Edition.Title
		if title == "" {
			title = b.Edition.Work.Title
		}
		books = append(books, fiber.Map{
			"edition_id": b.EditionID,
			"work_id":    b.Edition.WorkID,
			"title":      title,
			"author":     b.Edition.Work.Author.Name,
			"cover_url":  b.Edition.CoverURL,
			"pages":      b.Edition.PageCount,
			"cefr":       b.Edition.CEFRLevel,
			"read":       p.Read,
			"quiz_best":  p.QuizBest,
			"quiz_total": questions,
			"reviewed":   p.Reviewed,
			"next":       nextStep(p, questions),
		})
	}

	summary := challengeSummary(ch, uid)
	summary["books"] = books
	summary["standings"] = standings(ch.ID, 10, uid)
	// Reviews exist now, and posting one ticks this step — see
	// markChallengeReviewed in review.go.
	summary["review_step_available"] = true
	return c.JSON(summary)
}

func challengeSummary(ch models.Challenge, uid uint) fiber.Map {
	now := time.Now()
	state := "active"
	if now.Before(ch.StartsAt) {
		state = "upcoming"
	} else if now.After(ch.EndsAt) {
		state = "finished"
	}

	var participants int64
	database.DB.Model(&models.ChallengeParticipant{}).Where("challenge_id = ?", ch.ID).Count(&participants)

	var joined int64
	database.DB.Model(&models.ChallengeParticipant{}).
		Where("challenge_id = ? AND user_id = ?", ch.ID, uid).Count(&joined)

	covers := make([]string, 0, len(ch.Books))
	for _, b := range ch.Books {
		covers = append(covers, b.Edition.CoverURL)
	}

	// What is on offer, and how far this reader has got: the design's card
	// carries a progress bar, and the detail panel says "your points N / max".
	// A book with no quiz written yet cannot award quiz points, so the maximum
	// is counted per book rather than assumed.
	progress := progressMap(ch.ID, uid)
	maxPoints, steps, stepsDone := 0, 0, 0
	// "1 of 3 verified" on the design's card counts books whose quiz the reader
	// has passed — or, where no quiz exists yet, books they have marked read.
	verified := 0
	for _, b := range ch.Books {
		var questions int64
		database.DB.Model(&models.QuizQuestion{}).
			Where("challenge_id = ? AND edition_id = ?", ch.ID, b.EditionID).Count(&questions)

		p := progress[b.EditionID]
		maxPoints += models.PointsRead + models.PointsReview
		steps += 2
		if p.Read {
			stepsDone++
		}
		if p.Reviewed {
			stepsDone++
		}
		if questions > 0 {
			maxPoints += models.PointsQuiz
			steps++
			if p.QuizBest >= quizPassMark {
				stepsDone++
				verified++
			}
		} else if p.Read {
			verified++
		}
	}

	return fiber.Map{
		"id": ch.ID, "title": ch.Title, "description": ch.Description,
		"scope": ch.Scope, "prizes": ch.Prizes,
		"starts_at": ch.StartsAt, "ends_at": ch.EndsAt,
		"state": state, "days_left": int(ch.EndsAt.Sub(now).Hours() / 24),
		"participants": participants, "joined": joined > 0,
		"book_count": len(ch.Books), "covers": covers,
		"points": pointsFor(ch.ID, uid), "max_points": maxPoints,
		"steps": steps, "steps_done": stepsDone, "verified": verified,
		// The organiser, as the design names it: the school and how wide the
		// challenge reaches.
		"organiser":    organiserLabel(ch),
		"branch_count": branchCount(ch.SchoolID),
		"rules":        fiber.Map{"read": models.PointsRead, "quiz": models.PointsQuiz, "review": models.PointsReview},
	}
}

// nextStep is the single action the design shows per book: mark as read, then
// take the quiz, then write a review, then done.
func nextStep(p models.ChallengeProgress, questions int64) string {
	if !p.Read {
		return "read"
	}
	if questions > 0 && p.QuizBest < quizPassMark {
		return "quiz"
	}
	if !p.Reviewed {
		return "review"
	}
	return "done"
}

func progressMap(challengeID, uid uint) map[uint]models.ChallengeProgress {
	var rows []models.ChallengeProgress
	database.DB.Where("challenge_id = ? AND user_id = ?", challengeID, uid).Find(&rows)
	m := map[uint]models.ChallengeProgress{}
	for _, r := range rows {
		m[r.EditionID] = r
	}
	return m
}

func pointsFor(challengeID, uid uint) int {
	var rows []models.ChallengeProgress
	database.DB.Where("challenge_id = ? AND user_id = ?", challengeID, uid).Find(&rows)
	total := 0
	for _, r := range rows {
		if r.Read {
			total += models.PointsRead
		}
		if r.QuizBest >= quizPassMark {
			total += models.PointsQuiz
		}
		if r.Reviewed {
			total += models.PointsReview
		}
	}
	return total
}

/* --------------------------------------------------------------- joining */

// JoinChallenge adds the caller as a participant. Idempotent.
func JoinChallenge(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	schoolID, _ := callerSchoolID(c)
	id, _ := strconv.Atoi(c.Params("id"))

	var ch models.Challenge
	if err := database.DB.First(&ch, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Challenge not found"})
	}
	if ch.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your school's challenge"})
	}
	if time.Now().After(ch.EndsAt) {
		return c.Status(400).JSON(fiber.Map{"error": "This challenge has finished", "code": "FINISHED"})
	}

	var existing models.ChallengeParticipant
	err = database.DB.Where("challenge_id = ? AND user_id = ?", ch.ID, uid).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		database.DB.Create(&models.ChallengeParticipant{
			ChallengeID: ch.ID, UserID: uid, JoinedAt: time.Now(),
		})
	}
	return c.JSON(fiber.Map{"joined": true})
}

// MarkRead flips the "read" step for one book of a challenge.
func MarkRead(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	challengeID, _ := strconv.Atoi(c.Params("id"))
	var req struct {
		EditionID uint `json:"edition_id"`
		Read      bool `json:"read"`
	}
	if err := c.BodyParser(&req); err != nil || req.EditionID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}
	if err := requireParticipant(uint(challengeID), uid); err != nil {
		return err
	}

	p := upsertProgress(uint(challengeID), uid, req.EditionID)
	p.Read = req.Read
	database.DB.Save(&p)
	return c.JSON(p)
}

/* ------------------------------------------------------------------ quiz */

// GetQuiz returns the questions for one book, without the answers.
func GetQuiz(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	challengeID, _ := strconv.Atoi(c.Params("id"))
	editionID, _ := strconv.Atoi(c.Query("edition_id"))
	if editionID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "edition_id is required"})
	}
	if err := requireParticipant(uint(challengeID), uid); err != nil {
		return err
	}

	var qs []models.QuizQuestion
	database.DB.Where("challenge_id = ? AND edition_id = ?", challengeID, editionID).
		Order("sort asc, id asc").Find(&qs)
	if len(qs) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "No quiz for this book", "code": "NO_QUIZ"})
	}

	// Answer is json:"-" on the model, so it cannot leak by accident here.
	return c.JSON(fiber.Map{"questions": qs, "pass_mark": quizPassMark, "total": len(qs)})
}

// SubmitQuiz marks an attempt. Every attempt is recorded; the best score is
// what counts, and passing also marks the book read.
func SubmitQuiz(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	challengeID, _ := strconv.Atoi(c.Params("id"))
	var req struct {
		EditionID uint           `json:"edition_id"`
		Answers   map[string]int `json:"answers"` // question id -> chosen index
	}
	if err := c.BodyParser(&req); err != nil || req.EditionID == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}
	if err := requireParticipant(uint(challengeID), uid); err != nil {
		return err
	}

	var qs []models.QuizQuestion
	database.DB.Where("challenge_id = ? AND edition_id = ?", challengeID, req.EditionID).Find(&qs)
	if len(qs) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "No quiz for this book", "code": "NO_QUIZ"})
	}

	score := 0
	wrong := []uint{}
	for _, q := range qs {
		if got, ok := req.Answers[strconv.Itoa(int(q.ID))]; ok && got == q.Answer {
			score++
		} else {
			wrong = append(wrong, q.ID)
		}
	}
	passed := score >= quizPassMark

	database.DB.Create(&models.QuizAttempt{
		ChallengeID: uint(challengeID), UserID: uid, EditionID: req.EditionID,
		Score: score, Total: len(qs), Passed: passed, CreatedAt: time.Now(),
	})

	p := upsertProgress(uint(challengeID), uid, req.EditionID)
	if score > p.QuizBest {
		p.QuizBest = score
	}
	if passed {
		p.Read = true // passing verifies the read, as the design describes
	}
	database.DB.Save(&p)

	return c.JSON(fiber.Map{
		"score": score, "total": len(qs), "passed": passed,
		"best": p.QuizBest, "wrong": wrong,
		"points_awarded": map[bool]int{true: models.PointsQuiz, false: 0}[passed],
	})
}

/* ------------------------------------------------------------- standings */

// StandingRow is one participant in the frontrunners list.
type StandingRow struct {
	UserID   uint   `json:"user_id"`
	Name     string `json:"name"`
	Initials string `json:"initials"`
	Grade    string `json:"grade"`
	Branch   string `json:"branch"`
	Points   int    `json:"points"`
	Books    int    `json:"books"`
	IsMe     bool   `json:"is_me"`
}

func standings(challengeID uint, limit int, me uint) []StandingRow {
	var rows []models.ChallengeProgress
	database.DB.Where("challenge_id = ?", challengeID).Find(&rows)

	type agg struct{ points, books int }
	byUser := map[uint]*agg{}
	for _, r := range rows {
		a := byUser[r.UserID]
		if a == nil {
			a = &agg{}
			byUser[r.UserID] = a
		}
		if r.Read {
			a.points += models.PointsRead
			a.books++
		}
		if r.QuizBest >= quizPassMark {
			a.points += models.PointsQuiz
		}
		if r.Reviewed {
			a.points += models.PointsReview
		}
	}
	if len(byUser) == 0 {
		return []StandingRow{}
	}

	ids := make([]uint, 0, len(byUser))
	for id := range byUser {
		ids = append(ids, id)
	}
	var students []models.Student
	database.DB.Preload("Branch").Where("user_id IN ?", ids).Find(&students)

	out := make([]StandingRow, 0, len(students))
	for _, s := range students {
		a := byUser[s.UserID]
		grade := ""
		if s.Grade > 0 {
			grade = strconv.Itoa(s.Grade)
			if s.ClassGroup != "" {
				grade += "-" + s.ClassGroup
			}
		}
		out = append(out, StandingRow{
			UserID: s.UserID, Name: s.Name, Initials: initialsOf(s.Name),
			Grade: grade, Branch: s.Branch.Name,
			Points: a.points, Books: a.books, IsMe: s.UserID == me,
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Points > out[j].Points })

	// Keep the caller visible even when they are outside the cut, as the
	// design specifies ("you appended if outside").
	if len(out) > limit {
		kept := out[:limit]
		for _, r := range out[limit:] {
			if r.IsMe {
				kept = append(kept, r)
				break
			}
		}
		out = kept
	}
	return out
}

/* ----------------------------------------------------------------- utils */

func requireParticipant(challengeID, uid uint) error {
	var n int64
	database.DB.Model(&models.ChallengeParticipant{}).
		Where("challenge_id = ? AND user_id = ?", challengeID, uid).Count(&n)
	if n == 0 {
		return fiber.NewError(fiber.StatusForbidden, "Join the challenge first")
	}
	return nil
}

func upsertProgress(challengeID, uid, editionID uint) models.ChallengeProgress {
	var p models.ChallengeProgress
	err := database.DB.Where("challenge_id = ? AND user_id = ? AND edition_id = ?",
		challengeID, uid, editionID).First(&p).Error
	if err == gorm.ErrRecordNotFound {
		p = models.ChallengeProgress{ChallengeID: challengeID, UserID: uid, EditionID: editionID}
		database.DB.Create(&p)
	}
	return p
}

/* --------------------------------------------------- authoring (staff) */

// CreateChallenge is the back end of the teacher's Challenge Builder. Until a
// teacher role exists, librarians and managers author challenges for their own
// school; the school is taken from the caller, never from the request body.
func CreateChallenge(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school for this account"})
	}

	var req struct {
		Title       string    `json:"title"`
		Description string    `json:"description"`
		Prizes      string    `json:"prizes"`
		StartsAt    time.Time `json:"starts_at"`
		EndsAt      time.Time `json:"ends_at"`
		BranchID    *uint     `json:"branch_id"`
		EditionIDs  []uint    `json:"edition_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}
	if req.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A title is required"})
	}
	if req.EndsAt.Before(req.StartsAt) {
		return c.Status(400).JSON(fiber.Map{"error": "The end date is before the start date"})
	}

	ch := models.Challenge{
		SchoolID: schoolID, BranchID: req.BranchID,
		Title: req.Title, Description: req.Description, Prizes: req.Prizes,
		Scope:    models.ChallengeSchool,
		StartsAt: req.StartsAt, EndsAt: req.EndsAt,
		CreatedBy: uid, CreatedAt: time.Now(),
	}
	if err := database.DB.Create(&ch).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create challenge"})
	}
	for i, ed := range req.EditionIDs {
		database.DB.Create(&models.ChallengeBook{ChallengeID: ch.ID, EditionID: ed, Sort: i})
	}
	return c.JSON(ch)
}

// AddQuizQuestion appends a question to a challenge book. The answer index is
// accepted here and never returned to students.
func AddQuizQuestion(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}
	challengeID, _ := strconv.Atoi(c.Params("id"))

	var ch models.Challenge
	if err := database.DB.First(&ch, challengeID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Challenge not found"})
	}
	if ch.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your school's challenge"})
	}

	var req struct {
		EditionID uint   `json:"edition_id"`
		Prompt    string `json:"prompt"`
		OptionA   string `json:"option_a"`
		OptionB   string `json:"option_b"`
		OptionC   string `json:"option_c"`
		OptionD   string `json:"option_d"`
		Answer    int    `json:"answer"`
	}
	if err := c.BodyParser(&req); err != nil || req.EditionID == 0 || req.Prompt == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}
	if req.Answer < 0 || req.Answer > 3 {
		return c.Status(400).JSON(fiber.Map{"error": "The answer must be 0-3"})
	}

	var n int64
	database.DB.Model(&models.QuizQuestion{}).
		Where("challenge_id = ? AND edition_id = ?", challengeID, req.EditionID).Count(&n)

	q := models.QuizQuestion{
		ChallengeID: uint(challengeID), EditionID: req.EditionID, Prompt: req.Prompt,
		OptionA: req.OptionA, OptionB: req.OptionB, OptionC: req.OptionC, OptionD: req.OptionD,
		Answer: req.Answer, Sort: int(n),
	}
	if err := database.DB.Create(&q).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not add question"})
	}
	return c.JSON(q)
}

// DeleteChallenge removes a challenge and everything hanging off it.
func DeleteChallenge(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var ch models.Challenge
	if err := database.DB.First(&ch, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Challenge not found"})
	}
	if ch.SchoolID != schoolID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your school's challenge"})
	}

	database.DB.Where("challenge_id = ?", id).Delete(&models.ChallengeBook{})
	database.DB.Where("challenge_id = ?", id).Delete(&models.ChallengeParticipant{})
	database.DB.Where("challenge_id = ?", id).Delete(&models.ChallengeProgress{})
	database.DB.Where("challenge_id = ?", id).Delete(&models.QuizQuestion{})
	database.DB.Where("challenge_id = ?", id).Delete(&models.QuizAttempt{})
	database.DB.Delete(&models.Challenge{}, id)
	return c.JSON(fiber.Map{"deleted": true})
}

// organiserLabel is the school that set the challenge. The design prints it as
// "Hədəf · all 5 branches"; the branch count travels separately so the UI can
// phrase it in the reader's own language.
func organiserLabel(ch models.Challenge) string {
	if ch.School.Name != "" {
		return ch.School.Name
	}
	var school models.School
	if err := database.DB.Select("name").First(&school, ch.SchoolID).Error; err == nil {
		return school.Name
	}
	return ""
}

func branchCount(schoolID uint) int {
	var n int64
	database.DB.Model(&models.Branch{}).Where("school_id = ?", schoolID).Count(&n)
	return int(n)
}
