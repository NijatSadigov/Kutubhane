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
	BookCount int    `json:"book_count" gorm:"-"` // <-- "-" tells GORM: Do not save this in the DB!
}

type Author struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BranchID  uint   `json:"branch_id"`
	Branch    Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string `json:"name"`
	BookCount int    `json:"book_count" gorm:"-"` // <-- "-" tells GORM: Do not save this in the DB!
}

type Topic struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BranchID  uint   `json:"branch_id"`
	Branch    Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string `json:"name"`
	Location  string `json:"location"`
	BookCount int    `json:"book_count" gorm:"-"` // <-- "-" tells GORM: Do not save this in the DB!
}

type Genre struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BranchID  uint   `json:"branch_id"`
	Branch    Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Name      string `json:"name"`
	Location  string `json:"location"`
	BookCount int    `json:"book_count" gorm:"-"` // <-- "-" tells GORM: Do not save this in the DB!
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
