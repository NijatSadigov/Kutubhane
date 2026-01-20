package models

import "time"

type Book struct {
	ID       uint   `json:"id" gorm:"primaryKey"`
	BranchID uint   `json:"branch_id"`
	Branch   Branch `json:"branch" gorm:"foreignKey:BranchID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`

	Title           string `json:"title"`
	Author          string `json:"author"`
	Genre           string `json:"genre"`
	PageCount       int    `json:"page_count"`
	ISBN            string `json:"isbn"`
	Publisher       string `json:"publisher"`
	PublicationYear int    `json:"publication_year"`

	Copies []BookCopy `json:"copies,omitempty" gorm:"foreignKey:BookID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;"`
}
type BookCopy struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	BookID    uint   `json:"book_id"`
	Condition string `json:"condition"`
	Status    string `json:"status"` // "Available", "Loaned", "Reserved", "Lost"
	Book      Book   `json:"book" gorm:"foreignKey:BookID"`
}

type Loan struct {
	ID         uint       `json:"id" gorm:"primaryKey"`
	StudentID  uint       `json:"student_id"`
	BookCopyID uint       `json:"book_copy_id"`
	Student    Student    `json:"student" gorm:"foreignKey:StudentID"`
	BookCopy   BookCopy   `json:"book_copy" gorm:"foreignKey:BookCopyID"`
	IssueDate  time.Time  `json:"issue_date"`
	DueDate    time.Time  `json:"due_date"`
	ReturnDate *time.Time `json:"return_date"`
	Status     string     `json:"status"`
}

type Reservation struct {
	ID         uint `json:"id" gorm:"primaryKey"`
	StudentID  uint `json:"student_id"`
	BookCopyID uint `json:"book_copy_id"`

	Student  Student  `json:"student" gorm:"foreignKey:StudentID"`
	BookCopy BookCopy `json:"book_copy" gorm:"foreignKey:BookCopyID"`

	RequestDate time.Time `json:"request_date"`
	Status      string    `json:"status"` // "Pending", "Approved", "Rejected"
}
