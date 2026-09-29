package handlers

import (
	"hash/fnv"
	"math/rand"
	"time"

	"school-library-system/database"
	"school-library-system/models"
)

// How a quiz is actually sat: which questions a reader gets, how long they
// have, and the fact that they get one go.
//
// All three are here rather than in the screen because a time limit the client
// enforces is a suggestion, and a random draw the client makes is a list of
// every question in the pool sitting in the browser's memory. If the point is
// to make copying not worth the trouble, the server has to be the one holding
// the paper.

// approvedQuestions is the pool a reader can be asked from: the library's own
// questions and any reader suggestions it has approved. Pending and rejected
// ones are asked of nobody.
func approvedQuestions(challengeID uint, editionID uint) []models.QuizQuestion {
	var qs []models.QuizQuestion
	database.DB.
		Where("challenge_id = ? AND edition_id = ? AND status = ?",
			challengeID, editionID, models.QuestionApproved).
		Order("sort asc, id asc").Find(&qs)
	return qs
}

// drawFor picks the questions one reader is asked.
//
// The draw is **deterministic per reader**: the same person always gets the
// same questions for the same book, and two people usually get different ones.
// That matters more than it looks. A fresh random draw on every fetch would let
// a reader reload until they saw the whole pool, and would change the paper
// under someone who simply refreshed the page.
func drawFor(pool []models.QuizQuestion, draw int, challengeID, editionID, userID uint) []models.QuizQuestion {
	if draw <= 0 || draw >= len(pool) {
		return pool
	}

	h := fnv.New64a()
	for _, n := range []uint{challengeID, editionID, userID} {
		_, _ = h.Write([]byte{
			byte(n), byte(n >> 8), byte(n >> 16), byte(n >> 24),
		})
	}
	r := rand.New(rand.NewSource(int64(h.Sum64())))

	idx := r.Perm(len(pool))[:draw]
	out := make([]models.QuizQuestion, 0, draw)
	for _, i := range idx {
		out = append(out, pool[i])
	}
	// Back into the librarian's order, so a reader sees questions in a sensible
	// sequence rather than the shuffle's.
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].Sort < out[j-1].Sort; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

// openSession hands the paper out, or returns the one already handed out.
//
// Returning the existing row is the whole point: the clock started the first
// time the reader opened the quiz, and opening it again does not restart it.
func openSession(challengeID, userID, editionID uint) models.QuizSession {
	var s models.QuizSession
	err := database.DB.Where("challenge_id = ? AND user_id = ? AND edition_id = ?",
		challengeID, userID, editionID).First(&s).Error
	if err == nil {
		return s
	}
	s = models.QuizSession{
		ChallengeID: challengeID, UserID: userID, EditionID: editionID,
		IssuedAt: time.Now(),
	}
	database.DB.Create(&s)
	return s
}

// secondsLeft is what the reader has left of their allowance, given when the
// paper went out and how many questions they were given. Returns -1 when the
// quiz is untimed.
func secondsLeft(s models.QuizSession, secondsPerQuestion, questions int) int {
	if secondsPerQuestion <= 0 {
		return -1
	}
	total := secondsPerQuestion * questions
	spent := int(time.Since(s.IssuedAt).Seconds())
	if spent >= total {
		return 0
	}
	return total - spent
}

// quizGraceSeconds is slack on the server's clock check, to cover the seconds a
// slow connection spends carrying the answers back. The limit is there to stop
// somebody looking the answers up, not to punish bad wifi.
const quizGraceSeconds = 15

// nilIfZero sends an unset date out as null rather than as the zero time.
// Every screen was rendering that zero as "01.01.1", which reads like a bug
// because it is one.
func nilIfZero(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return t
}

// daysLeft is the countdown, or nil when the campaign has no end date — an
// open-ended one has no days left, it simply runs.
func daysLeft(ends time.Time, now time.Time) any {
	if ends.IsZero() {
		return nil
	}
	return int(ends.Sub(now).Hours() / 24)
}
