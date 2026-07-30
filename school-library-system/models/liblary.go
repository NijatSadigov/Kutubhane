package models

import "time"

// ==========================================
// 1. DYNAMIC CATEGORY MODELS (NEW)
// ==========================================
type Publisher struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BranchID  uint   `json:"branch_id"`
	Branch    Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string `json:"name"`
	Location  string `json:"location"`
	BookCount int    `json:"book_count" gorm:"->;-:migration"` // Computed via subquery: read-only, no real column
}

type Author struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BranchID  uint   `json:"branch_id"`
	Branch    Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string `json:"name"`
	BookCount int    `json:"book_count" gorm:"->;-:migration"` // Computed via subquery: read-only, no real column
}

type Topic struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BranchID  uint   `json:"branch_id"`
	Branch    Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string `json:"name"`
	Location  string `json:"location"`
	BookCount int    `json:"book_count" gorm:"->;-:migration"` // Computed via subquery: read-only, no real column
}

type Genre struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BranchID  uint   `json:"branch_id"`
	Branch    Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string `json:"name"`
	Location  string `json:"location"`
	BookCount int    `json:"book_count" gorm:"->;-:migration"` // Computed via subquery: read-only, no real column
}

type Frequency struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Type     string `json:"type"` // e.g., "Aylık", "Haftalık", "Günlük"
}

type CopyCondition struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name     string `json:"name"` // e.g., "Yeni", "Yıpranmış", "Kötü"
}

type CopyStatus struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name     string `json:"name"` // UI Name: "Verildi", "Öğrencide", "Müsait" (USER CAN CHANGE THIS)
	Code     string `json:"code"` // Backend Code: "LOANED", "AVAILABLE" (FIXED, HIDDEN)
}

// ==========================================
// 2. UPDATED BOOK & COPY MODELS
// ==========================================

type Book struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	// Basic Info
	Title               string `json:"title"`
	CoverURL            string `json:"cover_url"`
	ISBN                string `json:"isbn"`
	CallNo              string `json:"call_no"`
	Language            string `json:"language"`
	CEFRLevel           string `json:"cefr_level"`
	PublicationYear     int    `json:"publication_year"`
	Edition             string `json:"edition"`
	PageCount           int    `json:"page_count"`
	PhysicalDescription string `json:"physical_description"`
	AdditionalNotes     string `json:"additional_notes"`

	// E-Book Data
	HasEBook bool   `json:"has_ebook" gorm:"default:false"`
	EBookURL string `json:"ebook_url"`

	// Foreign Keys for Dynamic Categories (Pointers used so they can be nullable if missing)
	AuthorID    *uint `json:"author_id"`
	PublisherID *uint `json:"publisher_id"`
	TopicID     *uint `json:"topic_id"`
	GenreID     *uint `json:"genre_id"`
	FrequencyID *uint `json:"frequency_id"`

	// Relationships to load full category data automatically
	Author    Author    `json:"author" gorm:"foreignKey:AuthorID"`
	Publisher Publisher `json:"publisher" gorm:"foreignKey:PublisherID"`
	Topic     Topic     `json:"topic" gorm:"foreignKey:TopicID"`
	Genre     Genre     `json:"genre" gorm:"foreignKey:GenreID"`
	Frequency Frequency `json:"frequency" gorm:"foreignKey:FrequencyID"`

	// One-to-Many
	Copies []BookCopy `json:"copies,omitempty" gorm:"foreignKey:BookID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
type BookCopy struct {
	ID             uint   `json:"id" gorm:"primaryKey"` // Auto-increment DB ID
	BookID         uint   `json:"book_id"`
	TrackingNumber string `json:"tracking_number"` // <-- NEW: The physical label/barcode the librarian uses

	// Foreign Keys for Dynamic Conditions and Statuses
	ConditionID *uint `json:"condition_id"`
	StatusID    *uint `json:"status_id"`

	Condition CopyCondition `json:"condition" gorm:"foreignKey:ConditionID"`
	Status    CopyStatus    `json:"status" gorm:"foreignKey:StatusID"`

	Book Book `json:"book" gorm:"foreignKey:BookID"`
}

// ==========================================
// 3. UPDATED LOAN & RESERVATION MODELS
// ==========================================

type Loan struct {
	ID         uint `json:"id" gorm:"primaryKey"`
	StudentID  uint `json:"student_id"`
	BookCopyID uint `json:"book_copy_id"`

	Student  Student  `json:"student" gorm:"foreignKey:StudentID"`
	BookCopy BookCopy `json:"book_copy" gorm:"foreignKey:BookCopyID"`

	IssueDate  time.Time  `json:"issue_date"`
	DueDate    time.Time  `json:"due_date"`
	ReturnDate *time.Time `json:"return_date"`

	// Dynamic Status
	StatusID *uint      `json:"status_id"`
	Status   LoanStatus `json:"status" gorm:"foreignKey:StatusID"`

	Description string `json:"description"`
}

type Reservation struct {
	ID         uint `json:"id" gorm:"primaryKey"`
	StudentID  uint `json:"student_id"`
	BookCopyID uint `json:"book_copy_id"`

	Student  Student  `json:"student" gorm:"foreignKey:StudentID"`
	BookCopy BookCopy `json:"book_copy" gorm:"foreignKey:BookCopyID"`

	RequestDate time.Time `json:"request_date"`

	// Pickup window: the student's chosen number of days to collect the book, and
	// the concrete deadline set when the reservation is approved. Past the deadline
	// an approved reservation expires and its copy is freed.
	PickupDays     int        `json:"pickup_days"`
	PickupDeadline *time.Time `json:"pickup_deadline"`

	// Dynamic Status
	StatusID *uint             `json:"status_id"`
	Status   ReservationStatus `json:"status" gorm:"foreignKey:StatusID"`

	Description string `json:"description"`
}

type LoanStatus struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name     string `json:"name"`
	Code     string `json:"code"` // "ACTIVE", "RETURNED", "OVERDUE"
}

type ReservationStatus struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name     string `json:"name"`
	Code     string `json:"code"` // "PENDING", "APPROVED", "REJECTED", "COMPLETED"
}

// BookRequest is a student's request for a book the library does not have. It is
// free-text (title + author, optional note), branch-scoped, and worked by
// librarians/managers who fulfill or reject it. Status is a plain code, not one of
// the dynamic branch status tables.
type BookRequest struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	StudentID uint      `json:"student_id"`
	Student   Student   `json:"student" gorm:"foreignKey:StudentID"`
	BranchID  uint      `json:"branch_id"`
	Branch    Branch    `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Title     string    `json:"title"`
	Author    string    `json:"author"`
	Note      string    `json:"note"`
	Status    string    `json:"status" gorm:"default:PENDING"` // PENDING, FULFILLED, REJECTED
	CreatedAt time.Time `json:"created_at"`
}

// ReadingLog is one entry in a student's reading diary: the page they had reached
// in a borrowed book at a moment in time, plus an optional note. A book's reading
// speed (pages/day) is derived from the timestamps across its entries.
type ReadingLog struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	LoanID    uint      `json:"loan_id"`
	Loan      Loan      `json:"-" gorm:"foreignKey:LoanID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	StudentID uint      `json:"student_id"` // denormalized (= Student.UserID) for per-student queries
	Page      int       `json:"page"`       // current page reached at this update
	Note      string    `json:"note"`       // optional reflection on the reading
	CreatedAt time.Time `json:"created_at"`
}

// RegistrationToken is a branch-scoped invite that students use to self-register
// instead of typing a branch id. It carries an expiry and can be revoked — much
// like an API token.
type RegistrationToken struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	BranchID  uint      `json:"branch_id"`
	Branch    Branch    `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Token     string    `json:"token" gorm:"uniqueIndex"`
	Label     string    `json:"label"` // optional note, e.g. "7-A sınıfı 2024"
	ExpiresAt time.Time `json:"expires_at"`
	Revoked   bool      `json:"revoked" gorm:"default:false"`
	UseCount  int       `json:"use_count" gorm:"default:0"`
	CreatedAt time.Time `json:"created_at"`
}
