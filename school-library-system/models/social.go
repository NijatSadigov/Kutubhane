package models

import "time"

// ==========================================
// READER LAYER — shelves, notes, badges, challenges
// ==========================================
//
// These hang off the global catalog (Work / Edition), not off a branch holding,
// so a reader keeps their shelf and their progress if they change school or
// read a different branch's copy.

// Shelf statuses. A reader has at most one ShelfItem per work.
//
// These are deliberately distinct ideas and were conflated at first:
//
//	OWNED    the reader has the book — their own copy, not the library's
//	WANT     they would like to read it one day
//	READING  they are part way through it
//	READ     they have finished it
//
// "Add to my shelf" means OWNED. Wanting to read something is a different
// statement and gets its own list.
const (
	ShelfOwned   = "OWNED"
	ShelfWant    = "WANT"
	ShelfReading = "READING"
	ShelfRead    = "READ"
)

// ShelfItem is a reader's declared relationship to a work: want to read,
// reading, or read. "Reading" is usually implied by an active loan, but a
// reader can also be reading a book the library did not lend them.
type ShelfItem struct {
	ID     uint `json:"id" gorm:"primaryKey"`
	UserID uint `json:"user_id" gorm:"index:idx_shelf_user_work,unique"`
	WorkID uint `json:"work_id" gorm:"index:idx_shelf_user_work,unique"`
	Work   Work `json:"work,omitempty" gorm:"foreignKey:WorkID"`

	// EditionID records which edition they shelved, when they said.
	EditionID *uint `json:"edition_id"`

	Status string `json:"status" gorm:"default:WANT"`

	// Favorite is independent of Status: a reader can love a book they own, a
	// book they only want, or one they finished years ago. Making it a status
	// would force them to choose.
	Favorite bool `json:"favorite" gorm:"default:false"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Note is a reader's private note on a work. Never shown to anyone else — the
// design puts these on a warm tint precisely to signal that they are private.
type Note struct {
	ID     uint `json:"id" gorm:"primaryKey"`
	UserID uint `json:"user_id" gorm:"index"`
	WorkID uint `json:"work_id" gorm:"index"`
	Work   Work `json:"work,omitempty" gorm:"foreignKey:WorkID"`

	Text      string    `json:"text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Badge metrics. Progress is computed from data the system already has rather
// than incremented by hand, so a badge can never drift out of step with
// reality — and a recount fixes any past mistake.
const (
	BadgePages    = "PAGES"    // total pages logged
	BadgeBooks    = "BOOKS"    // books finished
	BadgeStreak   = "STREAK"   // consecutive days with a diary entry
	BadgeQuizzes  = "QUIZZES"  // challenge quizzes passed
	BadgeLangs    = "LANGS"    // distinct languages finished
	BadgeEarlyRet = "EARLYRET" // books returned before the due date
)

// Badge is a definition, seeded once per deployment. The colour and shape
// ReadingGoal is how many books a reader means to finish in a calendar year —
// the "2026 goal" card on their shelf. One row per reader per year; the reader
// sets it themselves and nobody else can see or change it.
type ReadingGoal struct {
	ID     uint `json:"id" gorm:"primaryKey"`
	UserID uint `json:"user_id" gorm:"index:idx_goal_user_year,unique"`
	Year   int  `json:"year" gorm:"index:idx_goal_user_year,unique"`
	Target int  `json:"target"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// fields come straight from the design's badge grid.
type Badge struct {
	ID          uint   `json:"id" gorm:"primaryKey"`
	Code        string `json:"code" gorm:"uniqueIndex"`
	Name        string `json:"name"`
	Description string `json:"description"`

	Glyph string `json:"glyph"`
	Shape string `json:"shape"` // circle, hex, shield, octa, squircle
	Fill  string `json:"fill"`
	Ring  string `json:"ring"`
	Tint  string `json:"tint"`
	Ink   string `json:"ink"`
	Tier  string `json:"tier"` // Gold, Silver, Bronze, or empty

	// Metric and Target define when it is earned, e.g. PAGES >= 10000.
	Metric string `json:"metric"`
	Target int    `json:"target"`
	Sort   int    `json:"sort"`
}

// UserBadge records that a reader reached a badge's target, and when. Progress
// below the target is computed live and not stored.
type UserBadge struct {
	ID       uint      `json:"id" gorm:"primaryKey"`
	UserID   uint      `json:"user_id" gorm:"index:idx_badge_user,unique"`
	BadgeID  uint      `json:"badge_id" gorm:"index:idx_badge_user,unique"`
	Badge    Badge     `json:"badge,omitempty" gorm:"foreignKey:BadgeID"`
	EarnedAt time.Time `json:"earned_at"`
	Pinned   bool      `json:"pinned"`
}

/* ------------------------------------------------------------ challenges */

// Challenge scope. ALLIANCE is modelled now but not yet enforceable, because
// alliances themselves are Phase 3 work.
const (
	ChallengeSchool   = "SCHOOL"
	ChallengeAlliance = "ALLIANCE"
)

// Points the design specifies: read +10, pass a quiz +15, write a review +5.
const (
	PointsRead   = 10
	PointsQuiz   = 15
	PointsReview = 5
)

// Challenge is a reading challenge run by a school, over a set of books and a
// fixed window.
type Challenge struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	SchoolID uint   `json:"school_id" gorm:"index"`
	School   School `json:"school,omitempty" gorm:"foreignKey:SchoolID"`
	// BranchID limits a challenge to one branch; nil means the whole school.
	BranchID *uint `json:"branch_id"`

	Title       string `json:"title"`
	Description string `json:"description"`
	Scope       string `json:"scope" gorm:"default:SCHOOL"`
	Prizes      string `json:"prizes"`

	StartsAt  time.Time `json:"starts_at"`
	EndsAt    time.Time `json:"ends_at"`
	CreatedBy uint      `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`

	Books []ChallengeBook `json:"books,omitempty" gorm:"foreignKey:ChallengeID;constraint:OnDelete:CASCADE;"`
}

// ChallengeBook is one title in a challenge.
type ChallengeBook struct {
	ID          uint    `json:"id" gorm:"primaryKey"`
	ChallengeID uint    `json:"challenge_id" gorm:"index"`
	EditionID   uint    `json:"edition_id"`
	Edition     Edition `json:"edition,omitempty" gorm:"foreignKey:EditionID"`
	Sort        int     `json:"sort"`
}

// ChallengeParticipant records that a reader joined.
type ChallengeParticipant struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	ChallengeID uint      `json:"challenge_id" gorm:"index:idx_part,unique"`
	UserID      uint      `json:"user_id" gorm:"index:idx_part,unique"`
	JoinedAt    time.Time `json:"joined_at"`
}

// ChallengeProgress is one reader's state on one book of one challenge.
type ChallengeProgress struct {
	ID          uint `json:"id" gorm:"primaryKey"`
	ChallengeID uint `json:"challenge_id" gorm:"index:idx_prog,unique"`
	UserID      uint `json:"user_id" gorm:"index:idx_prog,unique"`
	EditionID   uint `json:"edition_id" gorm:"index:idx_prog,unique"`

	Read     bool `json:"read"`
	QuizBest int  `json:"quiz_best"` // best score kept, as the design specifies
	Reviewed bool `json:"reviewed"`

	UpdatedAt time.Time `json:"updated_at"`
}

// QuizQuestion is one multiple-choice question for a book in a challenge.
// Options are stored as separate columns rather than JSON so the teacher's
// quiz editor can edit them field by field without parsing.
type QuizQuestion struct {
	ID          uint   `json:"id" gorm:"primaryKey"`
	ChallengeID uint   `json:"challenge_id" gorm:"index"`
	EditionID   uint   `json:"edition_id" gorm:"index"`
	Prompt      string `json:"prompt"`
	OptionA     string `json:"option_a"`
	OptionB     string `json:"option_b"`
	OptionC     string `json:"option_c"`
	OptionD     string `json:"option_d"`
	// Answer is the index of the correct option, 0–3. Never sent to students.
	Answer int `json:"-"`
	Sort   int `json:"sort"`
}

// QuizAttempt records a try. Every attempt is kept so a teacher can see effort,
// but only the best score counts.
type QuizAttempt struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	ChallengeID uint      `json:"challenge_id" gorm:"index"`
	UserID      uint      `json:"user_id" gorm:"index"`
	EditionID   uint      `json:"edition_id"`
	Score       int       `json:"score"`
	Total       int       `json:"total"`
	Passed      bool      `json:"passed"`
	CreatedAt   time.Time `json:"created_at"`
}

/* --------------------------------------------------------------- reviews */

// Review is a reader's rating and write-up of a WORK, not of a branch's copy,
// so opinions on the same novel aggregate across translations and reprints.
//
// Rating is stored in half-star steps (0.5 – 5.0), matching the design's
// half-star picker.
type Review struct {
	ID     uint `json:"id" gorm:"primaryKey"`
	WorkID uint `json:"work_id" gorm:"index:idx_review_user_work,unique"`
	Work   Work `json:"work,omitempty" gorm:"foreignKey:WorkID"`
	UserID uint `json:"user_id" gorm:"index:idx_review_user_work,unique"`

	// EditionID records which edition was read, for context on the review.
	EditionID *uint `json:"edition_id"`

	Rating  float64 `json:"rating"`
	Text    string  `json:"text"`
	Spoiler bool    `json:"spoiler"`

	// Hidden is set by a moderator. A hidden review stays in the database so a
	// teacher can see what happened, but is not served to readers.
	Hidden bool `json:"hidden" gorm:"default:false"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ReviewVote is one "helpful" vote. One per reader per review.
type ReviewVote struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ReviewID  uint      `json:"review_id" gorm:"index:idx_vote,unique"`
	UserID    uint      `json:"user_id" gorm:"index:idx_vote,unique"`
	CreatedAt time.Time `json:"created_at"`
}

// ReviewReply is a threaded reply under a review. Staff replies carry the
// Moderator badge the design shows.
type ReviewReply struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	ReviewID  uint      `json:"review_id" gorm:"index"`
	UserID    uint      `json:"user_id"`
	Text      string    `json:"text"`
	Hidden    bool      `json:"hidden" gorm:"default:false"`
	CreatedAt time.Time `json:"created_at"`
}

// Report reasons, from the design's moderation queue.
const (
	ReportSpoiler  = "SPOILER"
	ReportUnkind   = "UNKIND"
	ReportPersonal = "PERSONAL_INFO"
	ReportOffTopic = "OFF_TOPIC"
)

// ReviewReport is a reader flagging a review for a teacher to look at.
type ReviewReport struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	ReviewID uint   `json:"review_id" gorm:"index"`
	ReplyID  *uint  `json:"reply_id"`
	UserID   uint   `json:"user_id"`
	Reason   string `json:"reason"`
	Note     string `json:"note"`

	Resolved   bool       `json:"resolved" gorm:"default:false"`
	Resolution string     `json:"resolution"` // KEEP, SPOILER_TAG, HIDE, HIDE_WARN
	ResolvedBy *uint      `json:"resolved_by"`
	ResolvedAt *time.Time `json:"resolved_at"`

	CreatedAt time.Time `json:"created_at"`
}
