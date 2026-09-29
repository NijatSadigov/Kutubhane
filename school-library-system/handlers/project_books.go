package handlers

import (
	"strings"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// The reading list on a project, and the quiz that goes with it.
//
// A project with books *runs as* a Challenge. The reader-facing half of that —
// joining, marking a book read, answering the quiz, the standings — already
// exists and is exercised end to end; giving Project its own copy would have
// been a second implementation of a tested one, and would have left readers
// with two places to look for the same campaign.
//
// So these handlers are the staff's way in. They talk about a project; they
// keep a Challenge in step behind it. Everything the reader sees is the
// challenge, which is why attaching the first book is also the moment the
// campaign becomes visible to readers.

// ProjectBookView is one title on the reading list, with the questions set on
// it. The answer index is on QuizQuestion as `json:"-"`, so it cannot leak
// through here either.
type ProjectBookView struct {
	EditionID  uint                  `json:"edition_id"`
	Title      string                `json:"title"`
	AuthorName string                `json:"author_name"`
	CoverURL   string                `json:"cover_url"`
	Sort       int                   `json:"sort"`
	Questions  []models.QuizQuestion `json:"questions"`
}

// SetProjectBooks replaces a project's reading list.
//
// The first book creates the challenge behind the project, taking its title,
// dates and scope from the project so the two cannot describe themselves
// differently to staff and to readers. Emptying the list does **not** delete
// the challenge: readers may already have joined it and logged progress, and
// throwing that away because somebody cleared a box is not a thing a screen
// should do quietly.
func SetProjectBooks(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	p, err := findProject(c)
	if err != nil {
		return err
	}

	var req struct {
		EditionIDs []uint `json:"edition_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	if err := applyBooks(p, uid, req.EditionIDs); err != nil {
		return sendErr(c, err)
	}
	return c.JSON(fiber.Map{"books": projectBooks(p)})
}

// applyBooks validates and writes a project's reading list. Shared, because a
// reading list can be given when the project is created as well as changed
// afterwards, and the two must not check different things.
func applyBooks(p *models.Project, uid uint, editionIDs []uint) error {

	// Every edition must be real, or a reading list points at nothing.
	if len(editionIDs) > 0 {
		var n int64
		database.DB.Model(&models.Edition{}).Where("id IN ?", editionIDs).Count(&n)
		if int(n) != len(editionIDs) {
			return apiError{400, "A book on the list does not exist", "BAD_EDITION"}
		}
	}

	if p.ChallengeID == nil {
		if len(editionIDs) == 0 {
			// Nothing to do, and no reason to create an empty campaign.
			return nil
		}
		ch := models.Challenge{
			SchoolID: p.SchoolID, BranchID: p.BranchID,
			Title: p.Title, Description: p.Description,
			Scope:     models.ChallengeSchool,
			CreatedBy: uid, CreatedAt: time.Now(),
		}
		if p.StartsOn != nil {
			ch.StartsAt = *p.StartsOn
		}
		if p.EndsOn != nil {
			ch.EndsAt = *p.EndsOn
		}
		if err := database.DB.Create(&ch).Error; err != nil {
			return apiError{500, "Could not start the reading list", ""}
		}
		database.DB.Model(p).Update("challenge_id", ch.ID)
		p.ChallengeID = &ch.ID
	}

	// Replace the list. Questions are keyed on (challenge, edition), so a book
	// taken off the list and put back keeps the questions written for it —
	// which is what someone reordering a list expects, and losing them to a
	// stray click is not.
	database.DB.Where("challenge_id = ?", *p.ChallengeID).Delete(&models.ChallengeBook{})
	for i, ed := range editionIDs {
		database.DB.Create(&models.ChallengeBook{
			ChallengeID: *p.ChallengeID, EditionID: ed, Sort: i,
		})
	}

	return nil
}

// AddProjectQuestion writes one quiz question against a book on the list.
func AddProjectQuestion(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	if p.ChallengeID == nil {
		return c.Status(400).JSON(fiber.Map{
			"error": "Add a book before writing questions about it", "code": "NO_BOOKS"})
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
	// Four options or it is not the quiz the reader app draws.
	if strings.TrimSpace(req.OptionA) == "" || strings.TrimSpace(req.OptionB) == "" ||
		strings.TrimSpace(req.OptionC) == "" || strings.TrimSpace(req.OptionD) == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "All four answers are required", "code": "OPTIONS_REQUIRED"})
	}
	if req.Answer < 0 || req.Answer > 3 {
		return c.Status(400).JSON(fiber.Map{"error": "The answer must be one of the four"})
	}

	// The question must be about a book that is actually on this list.
	var on int64
	database.DB.Model(&models.ChallengeBook{}).
		Where("challenge_id = ? AND edition_id = ?", *p.ChallengeID, req.EditionID).Count(&on)
	if on == 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "That book is not on this project's list", "code": "NOT_ON_LIST"})
	}

	var n int64
	database.DB.Model(&models.QuizQuestion{}).
		Where("challenge_id = ? AND edition_id = ?", *p.ChallengeID, req.EditionID).Count(&n)

	q := models.QuizQuestion{
		ChallengeID: *p.ChallengeID, EditionID: req.EditionID,
		Prompt:  req.Prompt,
		OptionA: strings.TrimSpace(req.OptionA), OptionB: strings.TrimSpace(req.OptionB),
		OptionC: strings.TrimSpace(req.OptionC), OptionD: strings.TrimSpace(req.OptionD),
		Answer: req.Answer, Sort: int(n),
	}
	if err := database.DB.Create(&q).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not add the question"})
	}
	return c.JSON(q)
}

// DeleteProjectQuestion removes one, scoped through the project so a question
// on somebody else's campaign cannot be deleted by guessing an id.
func DeleteProjectQuestion(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	if p.ChallengeID == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Question not found"})
	}
	res := database.DB.Where("id = ? AND challenge_id = ?", c.Params("qid"), *p.ChallengeID).
		Delete(&models.QuizQuestion{})
	if res.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Question not found"})
	}
	return c.JSON(fiber.Map{"deleted": true})
}

// projectBooks is the reading list with its questions, in the order the list
// was set. Two queries rather than one per book.
func projectBooks(p *models.Project) []ProjectBookView {
	if p.ChallengeID == nil {
		return []ProjectBookView{}
	}

	var books []models.ChallengeBook
	database.DB.Preload("Edition.Work.Author").
		Where("challenge_id = ?", *p.ChallengeID).Order("sort").Find(&books)
	if len(books) == 0 {
		return []ProjectBookView{}
	}

	// Only the questions that are actually asked. A reader's suggestion lives
	// in the review queue until it is approved, and showing it here would make
	// the library's own list look longer than the quiz really is.
	var questions []models.QuizQuestion
	database.DB.
		Where("challenge_id = ? AND status = ?", *p.ChallengeID, models.QuestionApproved).
		Order("edition_id, sort").Find(&questions)
	byEdition := map[uint][]models.QuizQuestion{}
	for _, q := range questions {
		byEdition[q.EditionID] = append(byEdition[q.EditionID], q)
	}

	out := make([]ProjectBookView, 0, len(books))
	for _, b := range books {
		v := ProjectBookView{
			EditionID: b.EditionID, Sort: b.Sort,
			Title:     b.Edition.Title,
			CoverURL:  b.Edition.CoverURL,
			Questions: byEdition[b.EditionID],
		}
		if v.Questions == nil {
			v.Questions = []models.QuizQuestion{}
		}
		if v.Title == "" {
			v.Title = b.Edition.Work.Title
		}
		if b.Edition.Work.Author.Name != "" {
			v.AuthorName = b.Edition.Work.Author.Name
		}
		out = append(out, v)
	}
	return out
}
