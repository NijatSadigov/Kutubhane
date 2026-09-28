package models

import "time"

// 1. Base User
type User struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	Email     string     `json:"email" gorm:"unique"`
	Password  []byte     `json:"-"`
	Role      string     `json:"role"`
	Student   *Student   `json:"student,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Librarian *Librarian `json:"librarian,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Manager   *Manager   `json:"manager,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Teacher   *Teacher   `json:"teacher,omitempty" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

// 2. School
type School struct {
	ID      uint   `json:"id" gorm:"primaryKey"`
	Name    string `json:"name"`
	Address string `json:"address"`
	// When School is deleted, delete its Branches automatically
	Branches []Branch `json:"branches,omitempty" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	// School-level managers; deleted along with the school
	Managers []Manager `json:"managers,omitempty" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

// 3. Branch
type Branch struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	Name     string `json:"name"`
	SchoolID uint   `json:"school_id"`

	// Default cap on how many books a student here may hold at once (active loans
	// + pending/approved reservations combined). A Student.LoanLimit overrides it.
	LoanLimit int `json:"loan_limit" gorm:"default:5"`

	// Max days a student may take to pick up an approved reservation before it
	// expires and the copy is freed. Students pick a window up to this cap.
	MaxPickupDays int `json:"max_pickup_days" gorm:"default:7"`

	// How long a book is lent for. DefaultLoanDays is what the desk and the
	// reservation form fill in unasked — a branch that does not care about
	// per-loan periods simply confirms it — and MaxLoanDays caps what a student
	// may ask for, the way MaxPickupDays caps the collection window.
	DefaultLoanDays int `json:"default_loan_days" gorm:"default:14"`
	MaxLoanDays     int `json:"max_loan_days" gorm:"default:30"`

	// Computed by the handlers, read-only, no real column.
	StudentCount int `json:"student_count" gorm:"->;-:migration"`

	Librarians []Librarian `json:"librarians,omitempty" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
	Students   []Student   `json:"students,omitempty" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

// 4. Librarian
type Librarian struct {
	UserID   uint   `json:"user_id" gorm:"primaryKey"`
	Name     string `json:"name"`
	User     User   `json:"user" gorm:"foreignKey:UserID"`
	BranchID uint   `json:"branch_id"`
	// If Branch is deleted, delete this Librarian profile
	Branch Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	SchoolID uint `json:"school_id"`
	// If School is deleted, delete this Librarian profile
	School School `json:"school" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

// 4b. Manager — school-level administrator. Scoped to one School; a School may
// have several. Manages that school's branches, librarians and students.
type Manager struct {
	UserID uint   `json:"user_id" gorm:"primaryKey"`
	Name   string `json:"name"`
	User   User   `json:"user" gorm:"foreignKey:UserID"`

	SchoolID uint `json:"school_id"`
	// If School is deleted, delete this Manager profile
	School School `json:"school" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

// 5. Student
type Student struct {
	UserID uint   `json:"user_id" gorm:"primaryKey"`
	Name   string `json:"name"`

	BranchID uint `json:"branch_id"`
	// If Branch is deleted, delete this Student profile
	Branch Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Grade      int    `json:"grade"`
	ClassGroup string `json:"class_group"`

	// Which class group they sit in, and where they stand with the school.
	// Grade and ClassGroup above are the free-text pair this replaces; they are
	// left in place because the reader screens still print them, and a
	// classroom is only assigned once the school sets one up.
	ClassroomID *uint     `json:"classroom_id" gorm:"index"`
	Status      string    `json:"status" gorm:"index;default:ACTIVE"` // ACTIVE · ALUMNI · LEFT
	BirthDate   time.Time `json:"birth_date"`
	Loans       []Loan    `json:"loans" gorm:"foreignKey:StudentID;references:UserID"`

	// Optional per-student override of the branch borrow limit. Nil = use branch default.
	LoanLimit *int `json:"loan_limit"`

	// Bio is the line under the name on the reader's own profile — the design
	// puts one there and it is the only free text a student writes about
	// themselves. Visible to their school, like everything else on that page.
	Bio string `json:"bio"`
}
