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
}

// 2. School
type School struct {
	ID      uint   `json:"id" gorm:"primaryKey"`
	Name    string `json:"name"`
	Address string `json:"address"`
	// When School is deleted, delete its Branches automatically
	Branches []Branch `json:"branches,omitempty" gorm:"foreignKey:SchoolID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}

// 3. Branch
type Branch struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	Name     string `json:"name"`
	SchoolID uint   `json:"school_id"`

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

// 5. Student
type Student struct {
	UserID uint   `json:"user_id" gorm:"primaryKey"`
	Name   string `json:"name"`

	BranchID uint `json:"branch_id"`
	// If Branch is deleted, delete this Student profile
	Branch Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Grade      int       `json:"grade"`
	ClassGroup string    `json:"class_group"`
	BirthDate  time.Time `json:"birth_date"`
}
