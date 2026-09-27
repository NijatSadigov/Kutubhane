package models

import "time"

// Texniki dəstək — a librarian raising something with the school administration.
//
// This is the librarian → admin channel. It is deliberately *not* BookRequest,
// which is the student → librarian one: different author, different audience,
// different queue. A librarian asking for a title to be added to the system is
// TicketBookRequest here; a student asking their branch for a title stays a
// BookRequest.
//
// Scope follows the same rule as everything else in this system: BranchID is
// where the ticket came from and SchoolID is the queue it lands in, both taken
// from the author's own profile and never from a request body.

// Ticket kinds, from the three things the buyer named.
const (
	TicketBookRequest = "BOOK_REQUEST" // please add this title to the system
	TicketProblem     = "PROBLEM"      // something is broken or wrong
	TicketOther       = "OTHER"        // anything else needing the administration
)

// Ticket statuses. OPEN and IN_PROGRESS are "still mine to deal with" for the
// admin; RESOLVED and CLOSED are done. RESOLVED is the admin's word for "I have
// dealt with it", CLOSED the author's for "I no longer need this".
const (
	TicketOpen       = "OPEN"
	TicketInProgress = "IN_PROGRESS"
	TicketResolved   = "RESOLVED"
	TicketClosed     = "CLOSED"
)

// ValidTicketKind and ValidTicketStatus keep the handlers from having to repeat
// the lists, and keep a typo in a request body out of the database.
func ValidTicketKind(k string) bool {
	return k == TicketBookRequest || k == TicketProblem || k == TicketOther
}

func ValidTicketStatus(s string) bool {
	return s == TicketOpen || s == TicketInProgress || s == TicketResolved || s == TicketClosed
}

// TicketOpenStatuses is what both nav badges and the queue's default filter
// mean by "still needs someone".
var TicketOpenStatuses = []string{TicketOpen, TicketInProgress}

type Ticket struct {
	ID uint `json:"id" gorm:"primaryKey"`

	// Who raised it, and the scope they raised it from.
	AuthorID uint   `json:"author_id" gorm:"index"`
	BranchID uint   `json:"branch_id" gorm:"index"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	SchoolID uint   `json:"school_id" gorm:"index"`
	School   School `json:"school" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Kind    string `json:"kind" gorm:"default:OTHER"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
	Status  string `json:"status" gorm:"index;default:OPEN"`

	// Denormalised so the list does not need a join per row. Maintained by the
	// reply handlers, which are the only things that create replies.
	ReplyCount  int        `json:"reply_count" gorm:"default:0"`
	LastReplyAt *time.Time `json:"last_reply_at"`

	// One "last seen" stamp per side of the conversation, rather than a
	// per-user read table: a side has something new when LastReplyAt is newer
	// than its own stamp. Two participants, so two columns is the whole story.
	AuthorSeenAt *time.Time `json:"author_seen_at"`
	AdminSeenAt  *time.Time `json:"admin_seen_at"`

	// Who closed it out, and when.
	ResolvedBy *uint      `json:"resolved_by"`
	ResolvedAt *time.Time `json:"resolved_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TicketReply is one message in a ticket's thread, from either side.
type TicketReply struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	TicketID  uint      `json:"ticket_id" gorm:"index"`
	UserID    uint      `json:"user_id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}
