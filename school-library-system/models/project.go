package models

import "time"

// Layihələr — the school's reading projects and campaigns.
//
// Deliberately *not* a Challenge. A challenge is a book list with quizzes that
// individual readers join and are scored on; a project is longer-running work
// the school plans apart from the library's daily job — a book drive, an author
// visit, a class-against-class campaign. The two overlap in having a title and
// dates and nothing else, so folding one into the other would have meant a
// model that was half-empty whichever kind it was holding.
//
// What a project has that a challenge does not:
//
//   - a measurable goal ("collect 500 books", "read 10,000 pages") rather than
//     a fixed list of titles;
//   - a lifecycle, because a project is planned before it runs and reviewed
//     after it ends;
//   - classes as participants rather than individual sign-ups;
//   - a log of what actually happened, which is the only honest record of
//     long-running work.
//
// Progress is **derived from that log**, never stored. This is the same rule
// the textbook ledger follows and for the same reason: a running total kept
// beside its own history is a number that will eventually disagree with it.
type Project struct {
	ID uint `json:"id" gorm:"primaryKey"`

	// Scope follows Challenge's convention rather than inventing a third one:
	// the school owns it, and BranchID narrows it to one branch. Nil means the
	// whole school is running it.
	SchoolID uint   `json:"school_id" gorm:"index"`
	School   School `json:"school,omitempty" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	BranchID *uint  `json:"branch_id" gorm:"index"`

	Kind        string `json:"kind" gorm:"index;default:CAMPAIGN"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Status      string `json:"status" gorm:"index;default:PLANNED"`

	StartsOn *time.Time `json:"starts_on"`
	EndsOn   *time.Time `json:"ends_on"`

	// The goal, as a number and the thing being counted. GoalUnit is free text
	// because what a school counts differs per project — books, pages, manat,
	// visitors — and a fixed enum would be wrong by the second project.
	// A target of 0 means the project is not measured by a number at all,
	// which an author visit is not.
	GoalTarget int    `json:"goal_target"`
	GoalUnit   string `json:"goal_unit"`

	CreatedBy uint      `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Updates    []ProjectUpdate `json:"updates,omitempty" gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE;"`
	Classrooms []Classroom     `json:"classrooms,omitempty" gorm:"many2many:project_classrooms;joinForeignKey:ProjectID;joinReferences:ClassroomID"`
}

// ProjectUpdate is one thing that happened: a note, and optionally the number
// it contributed towards the goal. Append-only, like the textbook ledger.
//
// The classroom is how a class-against-class campaign keeps score without a
// second table — "4-A brought in 40 books" is one update with a classroom on
// it, and the standings are a group-by rather than a stored tally.
type ProjectUpdate struct {
	ID        uint `json:"id" gorm:"primaryKey"`
	ProjectID uint `json:"project_id" gorm:"index"`

	Body   string `json:"body"`
	Amount int    `json:"amount"` // what it contributed; may be 0 for a plain note

	ClassroomID *uint     `json:"classroom_id" gorm:"index"`
	Classroom   Classroom `json:"classroom,omitempty" gorm:"foreignKey:ClassroomID"`

	RecordedBy uint      `json:"recorded_by"`
	CreatedAt  time.Time `json:"created_at"`
}

// The kinds the buyer named. OTHER exists so a school is never blocked from
// recording something by a list written before they thought of it.
const (
	ProjectBookDrive = "BOOK_DRIVE" // collecting books or donations
	ProjectEvent     = "EVENT"      // an author visit, a reading week
	ProjectCampaign  = "CAMPAIGN"   // a reading push, class against class
	ProjectOther     = "OTHER"
)

func ValidProjectKind(k string) bool {
	return k == ProjectBookDrive || k == ProjectEvent ||
		k == ProjectCampaign || k == ProjectOther
}

// The lifecycle. PLANNED and ACTIVE are "still ours to run"; DONE and
// CANCELLED are closed, and are kept rather than deleted because what the
// school tried is worth as much as what it finished.
const (
	ProjectPlanned   = "PLANNED"
	ProjectActive    = "ACTIVE"
	ProjectDone      = "DONE"
	ProjectCancelled = "CANCELLED"
)

func ValidProjectStatus(s string) bool {
	return s == ProjectPlanned || s == ProjectActive ||
		s == ProjectDone || s == ProjectCancelled
}

// ProjectOpenStatuses is what a badge and the default filter mean by "still
// needs someone".
var ProjectOpenStatuses = []string{ProjectPlanned, ProjectActive}
