package handlers

import (
	"strings"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// Readers writing quiz questions, and the library deciding which of them are
// asked.
//
// The point is that a quiz gets better every year instead of being written once
// and then being the same ten questions for ever. A reader who has just
// finished the book is in a good position to ask something about it, and the
// library is in a good position to judge whether the question is any good.
//
// Nothing a reader writes is asked of anybody until it is approved. That is the
// whole safety story: a suggestion is inert until a librarian says otherwise.

// SetQuizSettings is the library's control of how a quiz is sat: seconds per
// question, how many of the pool each reader is asked, and whether readers may
// propose questions at all.
func SetQuizSettings(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	if p.ChallengeID == nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Add a book before setting up the quiz", "code": "NO_BOOKS"})
	}

	var req struct {
		QuizSeconds         *int  `json:"quiz_seconds"`
		QuizDraw            *int  `json:"quiz_draw"`
		QuizOpenSubmissions *bool `json:"quiz_open_submissions"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	updates := map[string]any{}
	if req.QuizSeconds != nil {
		if *req.QuizSeconds < 0 || *req.QuizSeconds > 3600 {
			return c.Status(400).JSON(fiber.Map{"error": "That is not a sensible time limit"})
		}
		updates["quiz_seconds"] = *req.QuizSeconds
	}
	if req.QuizDraw != nil {
		if *req.QuizDraw < 0 {
			return c.Status(400).JSON(fiber.Map{"error": "That is not a sensible number of questions"})
		}
		updates["quiz_draw"] = *req.QuizDraw
	}
	if req.QuizOpenSubmissions != nil {
		updates["quiz_open_submissions"] = *req.QuizOpenSubmissions
	}
	if len(updates) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Nothing to change"})
	}

	database.DB.Model(&models.Challenge{}).Where("id = ?", *p.ChallengeID).Updates(updates)

	var ch models.Challenge
	database.DB.First(&ch, *p.ChallengeID)
	return c.JSON(fiber.Map{
		"quiz_seconds": ch.QuizSeconds, "quiz_draw": ch.QuizDraw,
		"quiz_open_submissions": ch.QuizOpenSubmissions,
	})
}

// SuggestQuizQuestion is a reader proposing one. It lands PENDING and is asked
// of nobody until the library approves it.
func SuggestQuizQuestion(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	challengeID := uint(c.QueryInt("challenge_id"))
	if challengeID == 0 {
		if v, err := c.ParamsInt("id"); err == nil {
			challengeID = uint(v)
		}
	}

	var ch models.Challenge
	if err := database.DB.First(&ch, challengeID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Challenge not found"})
	}
	if !ch.QuizOpenSubmissions {
		return c.Status(403).JSON(fiber.Map{
			"error": "This quiz is not taking suggestions", "code": "SUBMISSIONS_CLOSED"})
	}
	// Only someone taking part may suggest a question for it.
	if err := requireParticipant(challengeID, uid); err != nil {
		return err
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
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A question is required"})
	}
	if strings.TrimSpace(req.OptionA) == "" || strings.TrimSpace(req.OptionB) == "" ||
		strings.TrimSpace(req.OptionC) == "" || strings.TrimSpace(req.OptionD) == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "All four answers are required", "code": "OPTIONS_REQUIRED"})
	}
	if req.Answer < 0 || req.Answer > 3 {
		return c.Status(400).JSON(fiber.Map{"error": "The answer must be one of the four"})
	}

	var onList int64
	database.DB.Model(&models.ChallengeBook{}).
		Where("challenge_id = ? AND edition_id = ?", challengeID, req.EditionID).Count(&onList)
	if onList == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "That book is not part of this project", "code": "NOT_ON_LIST"})
	}

	q := models.QuizQuestion{
		ChallengeID: challengeID, EditionID: req.EditionID,
		Prompt:  req.Prompt,
		OptionA: strings.TrimSpace(req.OptionA), OptionB: strings.TrimSpace(req.OptionB),
		OptionC: strings.TrimSpace(req.OptionC), OptionD: strings.TrimSpace(req.OptionD),
		Answer: req.Answer,
		Status: models.QuestionPending, SubmittedBy: &uid,
	}
	if err := database.DB.Create(&q).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save your question"})
	}
	return c.JSON(fiber.Map{"submitted": true, "id": q.ID})
}

// SuggestedQuestionView is a reader's suggestion as the library reviews it,
// with the answer they marked — which staff *do* need to see, unlike a reader.
type SuggestedQuestionView struct {
	ID        uint   `json:"id"`
	EditionID uint   `json:"edition_id"`
	BookTitle string `json:"book_title"`
	Prompt    string `json:"prompt"`
	OptionA   string `json:"option_a"`
	OptionB   string `json:"option_b"`
	OptionC   string `json:"option_c"`
	OptionD   string `json:"option_d"`
	Answer    int    `json:"answer"`
	Status    string `json:"status"`
	ByName    string `json:"by_name"`
}

// GetSuggestedQuestions lists what readers have proposed for a project.
func GetSuggestedQuestions(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	if p.ChallengeID == nil {
		return c.JSON([]SuggestedQuestionView{})
	}

	status := c.Query("status", models.QuestionPending)
	if status != models.QuestionPending && status != models.QuestionRejected &&
		status != models.QuestionApproved {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
	}

	var qs []models.QuizQuestion
	database.DB.Where("challenge_id = ? AND status = ? AND submitted_by IS NOT NULL",
		*p.ChallengeID, status).Order("id desc").Find(&qs)

	// The names and the titles in two queries rather than one per row.
	userIDs := make([]uint, 0, len(qs))
	editionIDs := make([]uint, 0, len(qs))
	for _, q := range qs {
		if q.SubmittedBy != nil {
			userIDs = append(userIDs, *q.SubmittedBy)
		}
		editionIDs = append(editionIDs, q.EditionID)
	}
	names := map[uint]string{}
	if len(userIDs) > 0 {
		var students []models.Student
		database.DB.Where("user_id IN ?", userIDs).Find(&students)
		for _, s := range students {
			names[s.UserID] = s.Name
		}
	}
	titles := map[uint]string{}
	if len(editionIDs) > 0 {
		var eds []models.Edition
		database.DB.Preload("Work").Where("id IN ?", editionIDs).Find(&eds)
		for _, e := range eds {
			t := e.Title
			if t == "" {
				t = e.Work.Title
			}
			titles[e.ID] = t
		}
	}

	out := make([]SuggestedQuestionView, 0, len(qs))
	for _, q := range qs {
		v := SuggestedQuestionView{
			ID: q.ID, EditionID: q.EditionID, BookTitle: titles[q.EditionID],
			Prompt: q.Prompt, OptionA: q.OptionA, OptionB: q.OptionB,
			OptionC: q.OptionC, OptionD: q.OptionD, Answer: q.Answer,
			Status: q.Status,
		}
		if q.SubmittedBy != nil {
			v.ByName = names[*q.SubmittedBy]
		}
		out = append(out, v)
	}
	return c.JSON(out)
}

// ReviewSuggestedQuestion approves a reader's question into the pool, or turns
// it down. An approved one joins the library's own and is asked from then on.
func ReviewSuggestedQuestion(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	if p.ChallengeID == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Question not found"})
	}

	var req struct {
		Approve bool   `json:"approve"`
		Note    string `json:"note"`
		// The library may fix which answer is right before approving — a good
		// question with the wrong answer marked is worth keeping.
		Answer *int `json:"answer"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var q models.QuizQuestion
	if err := database.DB.Where("id = ? AND challenge_id = ? AND submitted_by IS NOT NULL",
		c.Params("qid"), *p.ChallengeID).First(&q).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Question not found"})
	}

	updates := map[string]any{"review_note": strings.TrimSpace(req.Note)}
	if req.Approve {
		if req.Answer != nil {
			if *req.Answer < 0 || *req.Answer > 3 {
				return c.Status(400).JSON(fiber.Map{"error": "The answer must be one of the four"})
			}
			updates["answer"] = *req.Answer
		}
		// Goes to the end of the book's list, so approving one does not
		// reshuffle the order readers already see.
		var n int64
		database.DB.Model(&models.QuizQuestion{}).
			Where("challenge_id = ? AND edition_id = ?", *p.ChallengeID, q.EditionID).Count(&n)
		updates["sort"] = int(n)
		updates["status"] = models.QuestionApproved
	} else {
		updates["status"] = models.QuestionRejected
	}

	database.DB.Model(&q).Updates(updates)
	return c.JSON(fiber.Map{"status": updates["status"]})
}
