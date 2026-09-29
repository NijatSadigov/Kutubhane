package models

import "time"

// Notification — the one thing three features were each missing.
//
// A textbook request going Hazırdır, a reply on a ticket and an overdue
// reminder all had the same hole in them: the system knew something the person
// needed to know, and had no way to tell them. This is that way.
//
// It is keyed on UserID and nothing else, because all three already address a
// user: Loan.StudentID references Student.UserID, and TextbookRequest.TeacherID
// and Ticket.AuthorID are user ids too. One table serves a student, a teacher,
// a librarian and a manager without a per-role variant.
//
// Deliberately *not* stored: the sentence. Params carries the facts and the
// frontend renders them through the i18n file the rest of the app already uses.
// A reader who switches language sees the notification in the new one instead
// of whatever was frozen at write time, and no Azerbaijani ever goes near a Go
// string literal.
type Notification struct {
	ID uint `json:"id" gorm:"primaryKey"`

	// The recipient. Indexed with ReadAt because every query this table serves
	// is "my unread ones" or "my recent ones".
	UserID uint `json:"user_id" gorm:"index:idx_notifications_user_read,priority:1"`

	Kind string `json:"kind"`

	// What it is about, so a row can link somewhere useful. Subject is the
	// entity type and SubjectID its id; they are not a foreign key because the
	// three kinds point at three different tables.
	Subject   string `json:"subject"`
	SubjectID uint   `json:"subject_id"`

	// The facts the sentence is built from, as JSON — e.g.
	// {"title":"Riyaziyyat 5","class":"5-A"}. Written by notify(), read by the
	// frontend's renderer. Never prose.
	Params string `json:"params" gorm:"type:text"`

	ReadAt    *time.Time `json:"read_at" gorm:"index:idx_notifications_user_read,priority:2"`
	CreatedAt time.Time  `json:"created_at"`
}

// The three kinds, one per feature that was incomplete without this.
const (
	NotifyTextbookReady = "TEXTBOOK_READY" // a class's textbooks are ready to collect
	NotifyTicketReply   = "TICKET_REPLY"   // the other side answered a support ticket
	NotifyLoanOverdue   = "LOAN_OVERDUE"   // the desk nudged a reader about a late book
)

// The subject types a notification can point at.
const (
	NotifySubjectTextbookRequest = "textbook_request"
	NotifySubjectTicket          = "ticket"
	NotifySubjectLoan            = "loan"
)
