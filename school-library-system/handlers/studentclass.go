package handlers

import (
	"strings"

	"school-library-system/database"
	"school-library-system/models"

	"gorm.io/gorm"
)

// A reader's class is written down twice, and this file is the one place that
// keeps the two in step.
//
//	students.grade + students.class_group   the free-text pair every *reading*
//	                                        feature groups on: the standings,
//	                                        Üzvlər's class cards, the class
//	                                        beside a name on the desk, the
//	                                        class dashboard.
//	students.classroom_id → classrooms      the *dərslik* roster, which the
//	                                        administration builds and the
//	                                        textbook system issues against.
//
// They are the same fact: a Classroom carries a Grade and a Letter too. Two
// columns holding one fact drift unless something makes them agree, and until
// now nothing did — the invite link wrote the pair and never the room, while
// SetClassroomStudents wrote the room and never the pair. In the demo that
// showed up as a reader in 4-A for every reading feature who was not on 4-A's
// textbook roster: nobody would notice until the books were handed out and
// one child had none.
//
// The rule, now that there is one:
//
//   - On a roster, the room wins. grade/class_group mirror its grade/letter,
//     because an administrator putting a child in 5-A has said which class
//     they are in more deliberately than a sign-up link did.
//   - Not on a roster, the pair stands alone. Most classes in a school have
//     no Classroom row — the dərslik system is set up per class, and a school
//     may only run it for some. Those readers are in the standings and on
//     nobody's textbook roster, which is correct.
//   - Setting a pair that matches an existing room in the reader's branch puts
//     them on it. Setting one that does not takes them off whatever room they
//     were on, because they are not in that class any more.

// normaliseClass upper-cases and trims a class letter, so "a", " A" and "A"
// are one class rather than three in the standings. Grade 0 means "no class",
// which clears the letter with it.
func normaliseClass(grade int, group string) (int, string) {
	if grade <= 0 {
		return 0, ""
	}
	return grade, strings.ToUpper(strings.TrimSpace(group))
}

// classroomFor finds the branch's Classroom for a grade and letter, or nil.
func classroomFor(tx *gorm.DB, branchID uint, grade int, group string) *models.Classroom {
	if grade <= 0 || group == "" {
		return nil
	}
	var room models.Classroom
	err := tx.Where(
		"branch_id = ? AND grade = ? AND upper(trim(letter)) = ?",
		branchID, grade, strings.ToUpper(strings.TrimSpace(group)),
	).First(&room).Error
	if err != nil {
		return nil
	}
	return &room
}

// applyClassPair writes a reader's grade and letter and brings their dərslik
// roster with it: onto the matching room if the branch has one, off whatever
// room they were on if it does not.
func applyClassPair(tx *gorm.DB, stu *models.Student, grade int, group string) (int, string, *uint) {
	grade, group = normaliseClass(grade, group)

	var roomID *uint
	if room := classroomFor(tx, stu.BranchID, grade, group); room != nil {
		id := room.ID
		roomID = &id
	}

	err := tx.Model(&models.Student{}).Where("user_id = ?", stu.UserID).
		Updates(map[string]any{
			"grade":        grade,
			"class_group":  group,
			"classroom_id": roomID,
		}).Error
	if err != nil {
		return grade, group, nil
	}
	return grade, group, roomID
}

// attachClassroom is the sign-up half: a reader whose class the invite link
// named joins that room's roster if the branch runs one for it. It never takes
// anyone off a roster, because a new reader is not on one.
func attachClassroom(stu *models.Student) {
	if stu.ClassroomID != nil || stu.Grade <= 0 || stu.ClassGroup == "" {
		return
	}
	if room := classroomFor(database.DB, stu.BranchID, stu.Grade, stu.ClassGroup); room != nil {
		database.DB.Model(&models.Student{}).Where("user_id = ?", stu.UserID).
			Update("classroom_id", room.ID)
	}
}
