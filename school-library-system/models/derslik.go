package models

import "time"

// Dərslik — classroom textbooks, and the people and groups they move between.
//
// Deliberately separate from the Work/Edition/Book catalogue. A textbook is not
// a library book: it is stocked per branch in class sets, handed to a whole
// classroom at the start of a year and collected at the end, and it never
// belongs to the shared cross-school catalogue. Mixing the two would put
// twenty-five copies of "Riyaziyyat 4" into readers' search results and make
// every borrow-limit rule wrong.
//
// Accountability is per classroom, by quantity: the library issues N copies of
// a title to a class and expects N back. Where an individual matters — a lost
// book, a mid-year joiner — the teacher names them in the movement's note. That
// is how schools actually run it, and it keeps one row per title per class
// instead of one per student per title.

/* ------------------------------------------------------------ the people */

// Teacher is the role the design has assumed all along and the system never
// had. Scoped like a Librarian: one branch, one school.
type Teacher struct {
	UserID uint   `json:"user_id" gorm:"primaryKey"`
	Name   string `json:"name"`
	User   User   `json:"user" gorm:"foreignKey:UserID"`

	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SchoolID uint   `json:"school_id"`
	School   School `json:"school" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Subject string `json:"subject"` // what they teach, free text — a label, not a link
}

/* ----------------------------------------------------------- the calendar */

// AcademicYear is what a set of textbooks is issued *for*. Every request,
// issue and return is stamped with one, so "what did 4-A hold in 2026/2027?"
// is answerable after the books have come back.
type AcademicYear struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	SchoolID uint   `json:"school_id" gorm:"index"`
	School   School `json:"school" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Label    string    `json:"label"` // "2026/2027"
	StartsOn time.Time `json:"starts_on"`
	EndsOn   time.Time `json:"ends_on"`
	// Exactly one year per school is current; the handlers keep that true.
	IsCurrent bool `json:"is_current" gorm:"default:false"`

	CreatedAt time.Time `json:"created_at"`
}

// Subject is a line on the curriculum. School-scoped rather than branch-scoped:
// "Riyaziyyat" means the same thing in every branch of one school, and giving
// each branch its own copy would repeat the mistake that branch-scoped genres
// made — two rows no query could join. It is not global across schools, because
// curricula differ.
type Subject struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	SchoolID uint   `json:"school_id" gorm:"index"`
	School   School `json:"school" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Name    string `json:"name" gorm:"index"`
	NameKey string `json:"name_key" gorm:"index"`

	BookCount int       `json:"book_count" gorm:"->;-:migration"`
	CreatedAt time.Time `json:"created_at"`
}

/* --------------------------------------------------------- the classrooms */

// Classroom is one class group — 4-A — for one academic year. Created by the
// school administration, taught by one or more teachers, and holding the
// students who receive a set of textbooks together.
//
// It is tied to an academic year because 4-A in 2026/2027 and 4-A in 2027/2028
// are different groups of children; keeping them apart is what makes last
// year's issue record still mean something.
type Classroom struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id" gorm:"index"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SchoolID uint   `json:"school_id" gorm:"index"`

	Grade  int    `json:"grade"`  // 4
	Letter string `json:"letter"` // "A"

	AcademicYearID *uint        `json:"academic_year_id" gorm:"index"`
	AcademicYear   AcademicYear `json:"academic_year,omitempty" gorm:"foreignKey:AcademicYearID"`

	Teachers []Teacher `json:"teachers,omitempty" gorm:"many2many:classroom_teachers;joinForeignKey:ClassroomID;joinReferences:TeacherUserID"`

	// Computed, read-only.
	StudentCount int `json:"student_count" gorm:"->;-:migration"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Label is "4-A", built rather than stored so the two halves cannot drift.
func (c Classroom) Label() string {
	if c.Letter == "" {
		return itoa(c.Grade)
	}
	return itoa(c.Grade) + "-" + c.Letter
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var b [8]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}

// Where a student stands with the school. A reader who has left keeps their
// account and their reading history — the programme is theirs — but a classroom
// and a set of textbooks are not.
const (
	StudentActive = "ACTIVE"
	StudentAlumni = "ALUMNI"
	StudentLeft   = "LEFT" // left the school, still in the reading programme
)

func StudentGetsTextbooks(status string) bool {
	return status == "" || status == StudentActive
}

/* ----------------------------------------------------------- the textbooks */

// Textbook is a title the branch stocks in class sets. Branch-scoped on
// purpose: each school buys its own, in its own quantities.
type Textbook struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id" gorm:"index"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	SubjectID *uint   `json:"subject_id" gorm:"index"`
	Subject   Subject `json:"subject" gorm:"foreignKey:SubjectID"`

	Grade int    `json:"grade"` // which class it is for
	Title string `json:"title"`

	Author      string `json:"author"`
	Publisher   string `json:"publisher"`
	Year        int    `json:"year"`
	ISBN        string `json:"isbn"`
	PageCount   int    `json:"page_count"`
	CoverURL    string `json:"cover_url"`
	Language    string `json:"language"`
	Notes       string `json:"notes"`
	TotalCopies int    `json:"total_copies" gorm:"default:0"`

	// Computed by the handlers: how many are out with classes right now, and
	// what is therefore left on the shelf.
	IssuedCopies int `json:"issued_copies" gorm:"->;-:migration"`
	// Copies lost or written off: gone from the class and gone from the shelf.
	WrittenOffCopies int `json:"written_off_copies" gorm:"->;-:migration"`
	AvailableCopies  int `json:"available_copies" gorm:"->;-:migration"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

/* ------------------------------------------------------------ the requests */

// What a teacher is asking for.
const (
	ReqInitial     = "INITIAL"     // the year's set for a class
	ReqExtra       = "EXTRA"       // a new student arrived, a copy was lost
	ReqReplacement = "REPLACEMENT" // a damaged copy swapped
)

// Where the request has got to. The desk's side of it: somebody asks, the
// library checks and prepares, the teacher is invited, the teacher collects.
const (
	ReqPending   = "PENDING"   // waiting for the library to look
	ReqPreparing = "PREPARING" // accepted, being put together
	ReqReady     = "READY"     // ready to collect — the teacher is invited
	ReqCollected = "COLLECTED" // handed over; the books are with the class
	ReqRejected  = "REJECTED"
	ReqCancelled = "CANCELLED" // withdrawn by the teacher
)

func ValidRequestKind(k string) bool {
	return k == ReqInitial || k == ReqExtra || k == ReqReplacement
}

// OpenRequestStatuses is what "still needs somebody" means, for the nav badge
// and the queue's default filter.
var OpenRequestStatuses = []string{ReqPending, ReqPreparing, ReqReady}

type TextbookRequest struct {
	ID       uint `json:"id" gorm:"primaryKey"`
	BranchID uint `json:"branch_id" gorm:"index"`
	SchoolID uint `json:"school_id" gorm:"index"`

	ClassroomID uint      `json:"classroom_id" gorm:"index"`
	Classroom   Classroom `json:"classroom" gorm:"foreignKey:ClassroomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	AcademicYearID *uint        `json:"academic_year_id" gorm:"index"`
	AcademicYear   AcademicYear `json:"academic_year,omitempty" gorm:"foreignKey:AcademicYearID"`

	TeacherID uint `json:"teacher_id" gorm:"index"` // the user who raised it

	Kind   string `json:"kind" gorm:"default:INITIAL"`
	Status string `json:"status" gorm:"index;default:PENDING"`

	// When the class would like to collect, and when they undertake to bring
	// them back. Both are the teacher's ask; the library may change them.
	PickupOn *time.Time `json:"pickup_on"`
	ReturnBy *time.Time `json:"return_by"`

	Note        string     `json:"note"`       // the teacher's words
	DeskNote    string     `json:"desk_note"`  // the library's reply
	HandledBy   *uint      `json:"handled_by"` // the librarian who dealt with it
	ReadyAt     *time.Time `json:"ready_at"`
	CollectedAt *time.Time `json:"collected_at"`

	Lines []TextbookRequestLine `json:"lines,omitempty" gorm:"foreignKey:RequestID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// One title on a request. QtyApproved is the library's answer to QtyRequested —
// they may not have twenty-five on the shelf.
type TextbookRequestLine struct {
	ID        uint `json:"id" gorm:"primaryKey"`
	RequestID uint `json:"request_id" gorm:"index"`

	TextbookID uint     `json:"textbook_id" gorm:"index"`
	Textbook   Textbook `json:"textbook" gorm:"foreignKey:TextbookID"`

	QtyRequested int    `json:"qty_requested"`
	QtyApproved  int    `json:"qty_approved"`
	Note         string `json:"note"`
}

/* ------------------------------------------------------------- the ledger */

// Every movement of a textbook between the library and a class.
const (
	MoveIssue   = "ISSUE"
	MoveReturn  = "RETURN"
	MoveLost    = "LOST"
	MoveDamaged = "DAMAGED"
)

// TextbookMovement is the record of what actually happened, append-only.
//
// What a class currently holds is derived from it — issues minus returns,
// losses and write-offs — rather than kept as a running total that could drift
// out of step with its own history. The note is where a teacher names the
// student a loss belongs to, which is how an individual is accounted for
// without a row per child per book.
type TextbookMovement struct {
	ID       uint `json:"id" gorm:"primaryKey"`
	BranchID uint `json:"branch_id" gorm:"index"`

	ClassroomID uint      `json:"classroom_id" gorm:"index"`
	Classroom   Classroom `json:"classroom" gorm:"foreignKey:ClassroomID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	TextbookID uint     `json:"textbook_id" gorm:"index"`
	Textbook   Textbook `json:"textbook" gorm:"foreignKey:TextbookID"`

	AcademicYearID *uint `json:"academic_year_id" gorm:"index"`
	RequestID      *uint `json:"request_id" gorm:"index"`

	Kind string `json:"kind" gorm:"index"`
	Qty  int    `json:"qty"`

	Note       string `json:"note"` // "Ayan Məmmədova — itirilib"
	RecordedBy uint   `json:"recorded_by"`

	CreatedAt time.Time `json:"created_at"`
}
