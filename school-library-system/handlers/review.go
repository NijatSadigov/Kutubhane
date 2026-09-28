package handlers

import (
	"sort"
	"strconv"
	"strings"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Reviews and ratings. Reviews attach to a Work, so opinions aggregate across
// editions of the same book.

// ReviewView is a review as a reader sees it, with the author's display name
// resolved and the caller's own relationship to it.
type ReviewView struct {
	ID        uint      `json:"id"`
	WorkID    uint      `json:"work_id"`
	EditionID *uint     `json:"edition_id"`
	Rating    float64   `json:"rating"`
	Text      string    `json:"text"`
	Spoiler   bool      `json:"spoiler"`
	CreatedAt time.Time `json:"created_at"`

	AuthorName     string `json:"author_name"`
	AuthorInitials string `json:"author_initials"`
	AuthorSub      string `json:"author_sub"`  // "9-B · Nizami"
	AuthorRole     string `json:"author_role"` // student, librarian, manager, admin

	Helpful    int  `json:"helpful"`
	IVoted     bool `json:"i_voted"`
	IsMine     bool `json:"is_mine"`
	ReplyCount int  `json:"reply_count"`

	Replies []ReplyView `json:"replies,omitempty"`
}

// ReplyView is one threaded reply.
type ReplyView struct {
	ID             uint      `json:"id"`
	Text           string    `json:"text"`
	CreatedAt      time.Time `json:"created_at"`
	AuthorName     string    `json:"author_name"`
	AuthorInitials string    `json:"author_initials"`
	AuthorRole     string    `json:"author_role"`
	// IsModerator drives the "Teacher · Moderator" badge in the design.
	IsModerator bool `json:"is_moderator"`
	IsMine      bool `json:"is_mine"`
}

/* ----------------------------------------------------------------- read */

// GetWorkReviews lists the visible reviews for a work with the rating
// aggregate and histogram the book page needs.
//
// The feed is ordered most-helpful-first, which is what the book page's
// "Sorted by most helpful" caption claims. Helpful counts are assembled during
// decoration rather than in SQL, so the sort happens afterwards; it is stable,
// so reviews with equally many votes stay newest-first.
func GetWorkReviews(c *fiber.Ctx) error {
	uid, _ := currentUserID(c)
	workID, err := strconv.Atoi(c.Params("id"))
	if err != nil || workID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid work id"})
	}

	var reviews []models.Review
	if err := database.DB.
		Where("work_id = ? AND hidden = false", workID).
		Order("created_at desc").Find(&reviews).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load reviews"})
	}

	views := decorateReviews(reviews, uid, true)
	sort.SliceStable(views, func(i, j int) bool { return views[i].Helpful > views[j].Helpful })
	agg, hist := ratingAggregate(uint(workID))

	return c.JSON(fiber.Map{
		"reviews":   views,
		"rating":    agg.avg,
		"count":     agg.n,
		"histogram": hist, // [1★,2★,3★,4★,5★]
		"mine":      myReviewID(uint(workID), uid),
	})
}

type ratingAgg struct {
	avg *float64
	n   int
}

// ratingAggregate returns the mean rating and the 5→1 histogram. The mean is a
// pointer so "no ratings" is distinguishable from "rated zero".
func ratingAggregate(workID uint) (ratingAgg, [5]int) {
	var rows []models.Review
	database.DB.Select("rating").Where("work_id = ? AND hidden = false", workID).Find(&rows)

	var hist [5]int
	if len(rows) == 0 {
		return ratingAgg{nil, 0}, hist
	}
	sum := 0.0
	for _, r := range rows {
		sum += r.Rating
		// Round a half-star up into its star bucket: 4.5 counts as 5.
		b := int(r.Rating + 0.5)
		if b < 1 {
			b = 1
		}
		if b > 5 {
			b = 5
		}
		hist[b-1]++
	}
	avg := sum / float64(len(rows))
	avg = float64(int(avg*10+0.5)) / 10
	return ratingAgg{&avg, len(rows)}, hist
}

func myReviewID(workID, uid uint) *uint {
	if uid == 0 {
		return nil
	}
	var r models.Review
	if err := database.DB.Select("id").
		Where("work_id = ? AND user_id = ?", workID, uid).First(&r).Error; err == nil {
		return &r.ID
	}
	return nil
}

// decorateReviews resolves author names, vote counts and replies in bulk
// rather than per row.
// maskReviewAuthors rewrites a decorated feed for readers who are not signed
// in. Nearly every reviewer here is a schoolchild, so the open web gets
// initials and the school's name — never a full name, a grade or a branch,
// which together would identify a minor.
func maskReviewAuthors(views []ReviewView) []ReviewView {
	for i := range views {
		views[i].AuthorName = views[i].AuthorInitials
		views[i].AuthorSub = ""
		views[i].IsMine = false
		views[i].IVoted = false
		for j := range views[i].Replies {
			views[i].Replies[j].AuthorName = views[i].Replies[j].AuthorInitials
			views[i].Replies[j].IsMine = false
		}
	}
	return views
}

func decorateReviews(reviews []models.Review, uid uint, withReplies bool) []ReviewView {
	out := make([]ReviewView, 0, len(reviews))
	if len(reviews) == 0 {
		return out
	}

	ids := make([]uint, 0, len(reviews))
	userIDs := map[uint]bool{}
	for _, r := range reviews {
		ids = append(ids, r.ID)
		userIDs[r.UserID] = true
	}

	// votes
	type voteRow struct {
		ReviewID uint
		N        int
	}
	var votes []voteRow
	database.DB.Model(&models.ReviewVote{}).
		Select("review_id as review_id, count(*) as n").
		Where("review_id IN ?", ids).Group("review_id").Scan(&votes)
	voteBy := map[uint]int{}
	for _, v := range votes {
		voteBy[v.ReviewID] = v.N
	}

	mine := map[uint]bool{}
	if uid != 0 {
		var mv []models.ReviewVote
		database.DB.Where("review_id IN ? AND user_id = ?", ids, uid).Find(&mv)
		for _, v := range mv {
			mine[v.ReviewID] = true
		}
	}

	// replies
	repliesBy := map[uint][]models.ReviewReply{}
	if withReplies {
		var replies []models.ReviewReply
		database.DB.Where("review_id IN ? AND hidden = false", ids).
			Order("created_at asc").Find(&replies)
		for _, rp := range replies {
			repliesBy[rp.ReviewID] = append(repliesBy[rp.ReviewID], rp)
			userIDs[rp.UserID] = true
		}
	}

	people := resolvePeople(userIDs)

	for _, r := range reviews {
		p := people[r.UserID]
		v := ReviewView{
			ID: r.ID, WorkID: r.WorkID, EditionID: r.EditionID,
			Rating: r.Rating, Text: r.Text, Spoiler: r.Spoiler, CreatedAt: r.CreatedAt,
			AuthorName: p.name, AuthorInitials: initialsOf(p.name),
			AuthorSub: p.sub, AuthorRole: p.role,
			Helpful: voteBy[r.ID], IVoted: mine[r.ID], IsMine: r.UserID == uid,
			ReplyCount: len(repliesBy[r.ID]),
		}
		for _, rp := range repliesBy[r.ID] {
			rpp := people[rp.UserID]
			v.Replies = append(v.Replies, ReplyView{
				ID: rp.ID, Text: rp.Text, CreatedAt: rp.CreatedAt,
				AuthorName: rpp.name, AuthorInitials: initialsOf(rpp.name),
				AuthorRole:  rpp.role,
				IsModerator: rpp.role == "librarian" || rpp.role == "manager" || rpp.role == "admin",
				IsMine:      rp.UserID == uid,
			})
		}
		out = append(out, v)
	}
	return out
}

type person struct{ name, sub, role string }

// resolvePeople looks up display names for a set of user ids in one pass.
func resolvePeople(ids map[uint]bool) map[uint]person {
	out := map[uint]person{}
	if len(ids) == 0 {
		return out
	}
	list := make([]uint, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}

	var students []models.Student
	database.DB.Preload("Branch").Where("user_id IN ?", list).Find(&students)
	for _, s := range students {
		sub := ""
		if s.Grade > 0 {
			sub = strconv.Itoa(s.Grade)
			if s.ClassGroup != "" {
				sub += "-" + s.ClassGroup
			}
		}
		if s.Branch.Name != "" {
			if sub != "" {
				sub += " · "
			}
			sub += s.Branch.Name
		}
		out[s.UserID] = person{s.Name, sub, "student"}
	}

	var libs []models.Librarian
	database.DB.Preload("Branch").Where("user_id IN ?", list).Find(&libs)
	for _, l := range libs {
		out[l.UserID] = person{l.Name, l.Branch.Name, "librarian"}
	}

	var teachers []models.Teacher
	database.DB.Preload("Branch").Where("user_id IN ?", list).Find(&teachers)
	for _, t := range teachers {
		out[t.UserID] = person{t.Name, t.Branch.Name, "teacher"}
	}

	var mgrs []models.Manager
	database.DB.Where("user_id IN ?", list).Find(&mgrs)
	for _, m := range mgrs {
		out[m.UserID] = person{m.Name, "", "manager"}
	}

	// Anyone left is an admin or a deleted profile.
	for id := range ids {
		if _, ok := out[id]; !ok {
			out[id] = person{"—", "", "admin"}
		}
	}
	return out
}

/* ---------------------------------------------------------------- write */

// CreateReview writes or replaces the caller's review of a work. One review per
// reader per work, so posting again edits the existing one.
func CreateReview(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		WorkID    uint    `json:"work_id"`
		EditionID *uint   `json:"edition_id"`
		Rating    float64 `json:"rating"`
		Text      string  `json:"text"`
		Spoiler   bool    `json:"spoiler"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid data"})
	}

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

	// Half-star steps only, between 0.5 and 5.
	if req.Rating < 0.5 || req.Rating > 5 || req.Rating*2 != float64(int(req.Rating*2)) {
		return c.Status(400).JSON(fiber.Map{
			"error": "Rate in half stars, from 0.5 to 5", "code": "BAD_RATING",
		})
	}
	if strings.TrimSpace(req.Text) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Write a few words too", "code": "EMPTY_TEXT"})
	}

	var rev models.Review
	err = database.DB.Where("work_id = ? AND user_id = ?", req.WorkID, uid).First(&rev).Error
	if err == gorm.ErrRecordNotFound {
		rev = models.Review{
			WorkID: req.WorkID, UserID: uid, EditionID: req.EditionID,
			Rating: req.Rating, Text: req.Text, Spoiler: req.Spoiler,
		}
		if err := database.DB.Create(&rev).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not save review"})
		}
	} else if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save review"})
	} else {
		rev.Rating, rev.Text, rev.Spoiler = req.Rating, req.Text, req.Spoiler
		if req.EditionID != nil {
			rev.EditionID = req.EditionID
		}
		database.DB.Save(&rev)
	}

	// Reviewing a challenge book completes its review step.
	markChallengeReviewed(uid, req.WorkID)

	return c.JSON(rev)
}

// markChallengeReviewed ticks the review step on any active challenge whose
// book list includes an edition of this work.
func markChallengeReviewed(uid, workID uint) {
	var editions []models.Edition
	database.DB.Select("id").Where("work_id = ?", workID).Find(&editions)
	if len(editions) == 0 {
		return
	}
	ids := make([]uint, 0, len(editions))
	for _, e := range editions {
		ids = append(ids, e.ID)
	}

	var books []models.ChallengeBook
	database.DB.Where("edition_id IN ?", ids).Find(&books)
	for _, b := range books {
		var joined int64
		database.DB.Model(&models.ChallengeParticipant{}).
			Where("challenge_id = ? AND user_id = ?", b.ChallengeID, uid).Count(&joined)
		if joined == 0 {
			continue
		}
		p := upsertProgress(b.ChallengeID, uid, b.EditionID)
		if !p.Reviewed {
			p.Reviewed = true
			database.DB.Save(&p)
		}
	}
}

// DeleteReview removes the caller's own review. Staff can remove any review in
// their own school — that is moderation, and it is logged by the report trail.
func DeleteReview(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var rev models.Review
	if err := database.DB.First(&rev, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}

	role, _ := c.Locals("role").(string)
	isStaff := role == "librarian" || role == "manager" || role == "admin"
	if rev.UserID != uid && !isStaff {
		return c.Status(403).JSON(fiber.Map{"error": "Not your review"})
	}

	database.DB.Where("review_id = ?", id).Delete(&models.ReviewVote{})
	database.DB.Where("review_id = ?", id).Delete(&models.ReviewReply{})
	database.DB.Delete(&models.Review{}, id)
	return c.JSON(fiber.Map{"deleted": true})
}

// VoteReview toggles the caller's "helpful" vote. You cannot vote for your own.
func VoteReview(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var rev models.Review
	if err := database.DB.First(&rev, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}
	if rev.UserID == uid {
		return c.Status(400).JSON(fiber.Map{
			"error": "You cannot mark your own review helpful", "code": "OWN_REVIEW",
		})
	}

	var v models.ReviewVote
	err = database.DB.Where("review_id = ? AND user_id = ?", id, uid).First(&v).Error
	if err == gorm.ErrRecordNotFound {
		database.DB.Create(&models.ReviewVote{ReviewID: uint(id), UserID: uid, CreatedAt: time.Now()})
	} else {
		database.DB.Delete(&v)
	}

	var n int64
	database.DB.Model(&models.ReviewVote{}).Where("review_id = ?", id).Count(&n)
	return c.JSON(fiber.Map{"helpful": n, "i_voted": err == gorm.ErrRecordNotFound})
}

// ReplyToReview adds a threaded reply.
func ReplyToReview(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var req struct {
		Text string `json:"text"`
	}
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Text) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Write something first"})
	}

	var rev models.Review
	if err := database.DB.First(&rev, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}

	reply := models.ReviewReply{
		ReviewID: uint(id), UserID: uid, Text: req.Text, CreatedAt: time.Now(),
	}
	if err := database.DB.Create(&reply).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not post reply"})
	}
	return c.JSON(reply)
}

// ReportReview flags a review for a teacher. The design's reasons are Spoiler,
// Unkind, Personal info and Off-topic.
func ReportReview(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	id, _ := strconv.Atoi(c.Params("id"))

	var req struct {
		Reason string `json:"reason"`
		Note   string `json:"note"`
	}
	c.BodyParser(&req)
	switch req.Reason {
	case models.ReportSpoiler, models.ReportUnkind, models.ReportPersonal, models.ReportOffTopic:
	default:
		req.Reason = models.ReportOffTopic
	}

	var rev models.Review
	if err := database.DB.First(&rev, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}

	// One open report per reader per review is enough.
	var existing int64
	database.DB.Model(&models.ReviewReport{}).
		Where("review_id = ? AND user_id = ? AND resolved = false", id, uid).Count(&existing)
	if existing == 0 {
		database.DB.Create(&models.ReviewReport{
			ReviewID: uint(id), UserID: uid, Reason: req.Reason,
			Note: req.Note, CreatedAt: time.Now(),
		})
	}
	return c.JSON(fiber.Map{"reported": true})
}

/* ------------------------------------------------------- recent activity */

// GetRecentReviews backs the Discover activity feed and the landing page's
// "Fresh from the community". Scoped to the caller's school when signed in.
func GetRecentReviews(c *fiber.Ctx) error {
	uid, _ := currentUserID(c)
	limit, _ := strconv.Atoi(c.Query("limit", "12"))
	if limit <= 0 || limit > 50 {
		limit = 12
	}

	q := database.DB.Where("hidden = false")
	if schoolID, err := callerSchoolID(c); err == nil {
		// Only reviews by people in the caller's own school. Cross-school
		// visibility needs the alliance sharing rules, which do not exist yet.
		var ids []uint
		database.DB.Model(&models.Student{}).
			Joins("JOIN branches ON branches.id = students.branch_id").
			Where("branches.school_id = ?", schoolID).
			Pluck("students.user_id", &ids)
		var staff []uint
		database.DB.Model(&models.Librarian{}).Where("school_id = ?", schoolID).Pluck("user_id", &staff)
		ids = append(ids, staff...)
		if len(ids) == 0 {
			return c.JSON([]ReviewView{})
		}
		q = q.Where("user_id IN ?", ids)
	}

	var reviews []models.Review
	q.Order("created_at desc").Limit(limit).Find(&reviews)

	views := decorateReviews(reviews, uid, false)

	// The feed shows which book each review is about, so resolve the titles in
	// one query rather than one per row.
	workIDs := make([]uint, 0, len(views))
	for _, v := range views {
		workIDs = append(workIDs, v.WorkID)
	}
	titles := map[uint]string{}
	covers := map[uint]string{}
	if len(workIDs) > 0 {
		var works []models.Work
		database.DB.Where("id IN ?", workIDs).Find(&works)
		for _, w := range works {
			titles[w.ID] = w.Title
		}
		var eds []models.Edition
		database.DB.Where("work_id IN ? AND cover_url <> ''", workIDs).Find(&eds)
		for _, e := range eds {
			if _, ok := covers[e.WorkID]; !ok {
				covers[e.WorkID] = e.CoverURL
			}
		}
	}

	out := make([]fiber.Map, 0, len(views))
	for _, v := range views {
		out = append(out, fiber.Map{
			"review": v, "book_title": titles[v.WorkID], "cover_url": covers[v.WorkID],
		})
	}
	return c.JSON(out)
}

// GetTopReviewer backs the "Top Reviewer of the period" card: the reader whose
// reviews collected the most helpful votes.
func GetTopReviewer(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "No school"})
	}
	days, _ := strconv.Atoi(c.Query("days", "30"))
	if days <= 0 || days > 3650 {
		days = 30
	}
	since := time.Now().AddDate(0, 0, -days)

	type row struct {
		UserID  uint
		Reviews int
		Votes   int
	}
	var rows []row
	database.DB.Raw(`
		SELECT r.user_id             AS user_id,
		       COUNT(DISTINCT r.id)  AS reviews,
		       COUNT(v.id)           AS votes
		FROM reviews r
		JOIN students s  ON s.user_id = r.user_id
		JOIN branches b  ON b.id = s.branch_id
		LEFT JOIN review_votes v ON v.review_id = r.id
		WHERE b.school_id = ? AND r.hidden = false AND r.created_at >= ?
		GROUP BY r.user_id
		ORDER BY votes DESC, reviews DESC
		LIMIT 1`, schoolID, since).Scan(&rows)

	if len(rows) == 0 {
		return c.JSON(fiber.Map{"found": false})
	}

	top := rows[0]
	people := resolvePeople(map[uint]bool{top.UserID: true})
	p := people[top.UserID]

	var latest models.Review
	database.DB.Where("user_id = ? AND hidden = false", top.UserID).
		Order("created_at desc").First(&latest)

	var replies int64
	database.DB.Model(&models.ReviewReply{}).
		Joins("JOIN reviews ON reviews.id = review_replies.review_id").
		Where("reviews.user_id = ?", top.UserID).Count(&replies)

	return c.JSON(fiber.Map{
		"found": true, "user_id": top.UserID, "name": p.name,
		"initials": initialsOf(p.name), "sub": p.sub,
		"reviews": top.Reviews, "upvotes": top.Votes, "replies": replies,
		"quote": latest.Text, "rating": latest.Rating,
	})
}
