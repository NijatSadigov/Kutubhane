package handlers

import (
	"strings"
	"time"

	"school-library-system/catalog"
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

// The school's own structure: its years, its subjects, its classrooms and the
// teachers who take them. Set up by the school administration — a manager, or a
// platform admin — because a librarian does not decide who is in 4-A.
//
// Scope throughout comes from the caller's profile, never a request body.

/* ---------------------------------------------------------------- scoping */

// schoolScope resolves the school the caller administers. A manager has one; a
// platform admin may name any with ?school_id=, and gets the first otherwise so
// a single-school deployment needs no parameter.
func schoolScope(c *fiber.Ctx) (uint, error) {
	role, _ := c.Locals("role").(string)
	if role == "admin" {
		if v := c.QueryInt("school_id"); v > 0 {
			return uint(v), nil
		}
		var s models.School
		if err := database.DB.Order("id").First(&s).Error; err != nil {
			return 0, fiber.NewError(fiber.StatusNotFound, "No school exists yet")
		}
		return s.ID, nil
	}
	return resolveManagerSchoolID(c)
}

// branchesOf lists a school's branch ids, for the scope checks below.
func branchesOf(schoolID uint) []uint {
	var ids []uint
	database.DB.Model(&models.Branch{}).Where("school_id = ?", schoolID).Pluck("id", &ids)
	return ids
}

/* ---------------------------------------------------------- academic years */

func GetAcademicYears(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return err
	}
	var years []models.AcademicYear
	database.DB.Where("school_id = ?", schoolID).Order("starts_on desc").Find(&years)
	return c.JSON(years)
}

func CreateAcademicYear(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var req struct {
		Label     string `json:"label"`
		StartsOn  string `json:"starts_on"`
		EndsOn    string `json:"ends_on"`
		IsCurrent bool   `json:"is_current"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if strings.TrimSpace(req.Label) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A label is required"})
	}

	y := models.AcademicYear{
		SchoolID: schoolID,
		Label:    strings.TrimSpace(req.Label),
		StartsOn: parseDay(req.StartsOn),
		EndsOn:   parseDay(req.EndsOn),
	}
	if err := database.DB.Create(&y).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the year"})
	}
	if req.IsCurrent {
		setCurrentYear(schoolID, y.ID)
		y.IsCurrent = true
	}
	return c.JSON(y)
}

func SetCurrentAcademicYear(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var y models.AcademicYear
	if err := database.DB.Where("id = ? AND school_id = ?", c.Params("id"), schoolID).
		First(&y).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Year not found"})
	}
	setCurrentYear(schoolID, y.ID)
	y.IsCurrent = true
	return c.JSON(y)
}

// Exactly one year is current per school, so switching clears the others in the
// same breath rather than leaving two.
func setCurrentYear(schoolID, yearID uint) {
	database.DB.Model(&models.AcademicYear{}).
		Where("school_id = ?", schoolID).Update("is_current", false)
	database.DB.Model(&models.AcademicYear{}).
		Where("id = ?", yearID).Update("is_current", true)
}

func currentYearID(schoolID uint) *uint {
	var y models.AcademicYear
	if database.DB.Where("school_id = ? AND is_current = ?", schoolID, true).First(&y).Error == nil {
		return &y.ID
	}
	return nil
}

func parseDay(s string) time.Time {
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t
	}
	return time.Time{}
}

// GetSchoolBranches lists the caller's school's branches.
//
// /manager/school already carries them, but it resolves a manager profile and
// so refuses a platform admin. Everything in this file scopes through
// callerSchoolID instead, which answers for every role — and a branch list is
// what any screen creating something branch-scoped needs.
func GetSchoolBranches(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return err
	}
	var branches []models.Branch
	database.DB.
		Select(`branches.*, (SELECT count(*) FROM students
		          WHERE students.branch_id = branches.id
		            AND students.status = 'ACTIVE') as student_count`).
		Where("school_id = ?", schoolID).Order("name").Find(&branches)
	return c.JSON(branches)
}

/* ----------------------------------------------------------------- subjects */

func GetSubjects(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return err
	}
	var subjects []models.Subject
	database.DB.
		Select(`subjects.*, (SELECT count(*) FROM textbooks WHERE textbooks.subject_id = subjects.id) as book_count`).
		Where("school_id = ?", schoolID).Order("name").Find(&subjects)
	return c.JSON(subjects)
}

func CreateSubject(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	key := catalog.NormalizeKey(req.Name)
	if key == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A name is required"})
	}
	var existing models.Subject
	if database.DB.Where("school_id = ? AND name_key = ?", schoolID, key).
		First(&existing).Error == nil {
		return c.JSON(existing)
	}
	s := models.Subject{SchoolID: schoolID, Name: strings.TrimSpace(req.Name), NameKey: key}
	if err := database.DB.Create(&s).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the subject"})
	}
	return c.JSON(s)
}

func DeleteSubject(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var n int64
	database.DB.Model(&models.Textbook{}).Where("subject_id = ?", c.Params("id")).Count(&n)
	if n > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "This subject still has textbooks", "code": "IN_USE", "count": n})
	}
	database.DB.Where("school_id = ?", schoolID).Delete(&models.Subject{}, c.Params("id"))
	return c.SendStatus(200)
}

/* --------------------------------------------------------------- classrooms */

// GetClassrooms lists the school's classes. A teacher sees only their own,
// which is what their screens are built from; everyone else sees the school.
func GetClassrooms(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return err
	}

	q := database.DB.
		Select(`classrooms.*, (SELECT count(*) FROM students
		         WHERE students.classroom_id = classrooms.id
		           AND students.status = 'ACTIVE') as student_count`).
		Preload("Teachers").Preload("AcademicYear").
		Where("classrooms.school_id = ?", schoolID)

	role, _ := c.Locals("role").(string)
	if role == "teacher" {
		uid, err := currentUserID(c)
		if err != nil {
			return err
		}
		q = q.Joins("JOIN classroom_teachers ct ON ct.classroom_id = classrooms.id").
			Where("ct.teacher_user_id = ?", uid)
	}
	if y := c.QueryInt("year_id"); y > 0 {
		q = q.Where("classrooms.academic_year_id = ?", y)
	}

	var rooms []models.Classroom
	q.Order("classrooms.grade, classrooms.letter").Find(&rooms)
	return c.JSON(classroomViews(rooms))
}

// ClassroomView adds the label and the teachers' names, which every screen
// wants and none should have to assemble.
type ClassroomView struct {
	models.Classroom
	Label    string   `json:"label"`
	Teachers []string `json:"teacher_names"`
}

func classroomViews(rooms []models.Classroom) []ClassroomView {
	out := make([]ClassroomView, 0, len(rooms))
	for _, r := range rooms {
		names := make([]string, 0, len(r.Teachers))
		for _, t := range r.Teachers {
			names = append(names, t.Name)
		}
		out = append(out, ClassroomView{Classroom: r, Label: r.Label(), Teachers: names})
	}
	return out
}

func CreateClassroom(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var req struct {
		BranchID       uint   `json:"branch_id"`
		Grade          int    `json:"grade"`
		Letter         string `json:"letter"`
		AcademicYearID *uint  `json:"academic_year_id"`
		TeacherIDs     []uint `json:"teacher_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Grade < 1 {
		return c.Status(400).JSON(fiber.Map{"error": "A grade is required"})
	}
	if !branchInSchool(req.BranchID, schoolID) {
		return c.Status(400).JSON(fiber.Map{"error": "That branch is not in this school"})
	}
	if req.AcademicYearID == nil {
		req.AcademicYearID = currentYearID(schoolID)
	}

	room := models.Classroom{
		BranchID: req.BranchID, SchoolID: schoolID,
		Grade: req.Grade, Letter: strings.ToUpper(strings.TrimSpace(req.Letter)),
		AcademicYearID: req.AcademicYearID,
	}
	if err := database.DB.Create(&room).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the classroom"})
	}
	if len(req.TeacherIDs) > 0 {
		if err := setClassroomTeachers(room.ID, schoolID, req.TeacherIDs); err != nil {
			return err
		}
	}
	database.DB.Preload("Teachers").First(&room, room.ID)
	return c.JSON(classroomViews([]models.Classroom{room})[0])
}

// SetClassroomTeachers replaces the teachers on a class. Both sides are
// many-to-many: a class may be taken by several teachers, and a teacher may
// take several classes.
func SetClassroomTeachers(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var room models.Classroom
	if err := database.DB.Where("id = ? AND school_id = ?", c.Params("id"), schoolID).
		First(&room).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Classroom not found"})
	}
	var req struct {
		TeacherIDs []uint `json:"teacher_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if err := setClassroomTeachers(room.ID, schoolID, req.TeacherIDs); err != nil {
		return err
	}
	database.DB.Preload("Teachers").First(&room, room.ID)
	return c.JSON(classroomViews([]models.Classroom{room})[0])
}

func setClassroomTeachers(classroomID, schoolID uint, ids []uint) error {
	database.DB.Exec("DELETE FROM classroom_teachers WHERE classroom_id = ?", classroomID)
	for _, id := range ids {
		var t models.Teacher
		if database.DB.Where("user_id = ? AND school_id = ?", id, schoolID).
			First(&t).Error != nil {
			continue // not a teacher of this school; skip rather than fail the lot
		}
		database.DB.Exec(
			"INSERT INTO classroom_teachers (classroom_id, teacher_user_id) VALUES (?, ?)",
			classroomID, id)
	}
	return nil
}

// SetClassroomStudents puts students into a class. A student sits in exactly
// one, so assigning them here removes them from wherever they were.
func SetClassroomStudents(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var room models.Classroom
	if err := database.DB.Where("id = ? AND school_id = ?", c.Params("id"), schoolID).
		First(&room).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Classroom not found"})
	}
	var req struct {
		StudentIDs []uint `json:"student_ids"`
		Replace    bool   `json:"replace"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Replace {
		database.DB.Model(&models.Student{}).Where("classroom_id = ?", room.ID).
			Update("classroom_id", nil)
	}
	branches := branchesOf(schoolID)
	n := 0
	for _, id := range req.StudentIDs {
		res := database.DB.Model(&models.Student{}).
			Where("user_id = ? AND branch_id IN ?", id, branches).
			Update("classroom_id", room.ID)
		n += int(res.RowsAffected)
	}
	return c.JSON(fiber.Map{"assigned": n})
}

// GetClassroomStudents is the roster.
func GetClassroomStudents(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return err
	}
	var room models.Classroom
	if err := database.DB.Where("id = ? AND school_id = ?", c.Params("id"), schoolID).
		First(&room).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Classroom not found"})
	}
	var students []models.Student
	database.DB.Where("classroom_id = ?", room.ID).Order("name").Find(&students)
	return c.JSON(students)
}

// StudentPick is the minimum needed to put a child in a class: who they are and
// where they are now. Deliberately not /class-list, which carries loans and
// reading statistics and is a librarian's view of their own branch — assigning
// a class needs a name, not a reading history.
type StudentPick struct {
	UserID      uint   `json:"user_id"`
	Name        string `json:"name"`
	Grade       int    `json:"grade"`
	ClassGroup  string `json:"class_group"`
	BranchID    uint   `json:"branch_id"`
	ClassroomID *uint  `json:"classroom_id"`
	Status      string `json:"status"`
}

// GetSchoolStudents lists the school's students for class assignment.
func GetSchoolStudents(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return err
	}
	var out []StudentPick
	q := database.DB.Model(&models.Student{}).
		Select(`students.user_id, students.name, students.grade, students.class_group,
		        students.branch_id, students.classroom_id, students.status`).
		Joins("JOIN branches ON branches.id = students.branch_id").
		Where("branches.school_id = ?", schoolID)
	if b := c.QueryInt("branch_id"); b > 0 {
		q = q.Where("students.branch_id = ?", b)
	}
	// A graduate or a leaver has no class to be put in.
	if c.Query("all") != "true" {
		q = q.Where("students.status = ? OR students.status IS NULL OR students.status = ''",
			models.StudentActive)
	}
	q.Order("students.grade, students.name").Scan(&out)
	return c.JSON(out)
}

// SetStudentStatus moves a reader between ACTIVE, ALUMNI and LEFT.
//
// Graduating or leaving takes the classroom away — a set of textbooks belongs
// to a class — but never the account or the reading history, because the
// programme is theirs to keep.
func SetStudentStatus(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	switch req.Status {
	case models.StudentActive, models.StudentAlumni, models.StudentLeft:
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
	}

	var st models.Student
	if err := database.DB.Where("user_id = ? AND branch_id IN ?", c.Params("id"), branchesOf(schoolID)).
		First(&st).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Student not found"})
	}

	updates := map[string]interface{}{"status": req.Status}
	if req.Status != models.StudentActive {
		updates["classroom_id"] = nil
	}
	database.DB.Model(&models.Student{}).Where("user_id = ?", st.UserID).Updates(updates)
	database.DB.First(&st, "user_id = ?", st.UserID)
	return c.JSON(st)
}

/* ------------------------------------------------------------------ teachers */

func GetTeachers(c *fiber.Ctx) error {
	schoolID, err := callerSchoolID(c)
	if err != nil {
		return err
	}
	var teachers []models.Teacher
	// The account too: the settings screen lists each teacher's email, and
	// User hides its password hash from JSON, so this is safe to send.
	database.DB.Preload("Branch").Preload("User").
		Where("school_id = ?", schoolID).Order("name").Find(&teachers)
	return c.JSON(teachers)
}

// AddTeacher creates the login and the profile together, the way AddLibrarian
// does — a teacher with no account cannot raise a textbook request.
func AddTeacher(c *fiber.Ctx) error {
	schoolID, err := schoolScope(c)
	if err != nil {
		return err
	}
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
		BranchID uint   `json:"branch_id"`
		Subject  string `json:"subject"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Name == "" || req.Email == "" || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name, email and password are required"})
	}
	if !branchInSchool(req.BranchID, schoolID) {
		return c.Status(400).JSON(fiber.Map{"error": "That branch is not in this school"})
	}
	var clash models.User
	if database.DB.Where("email = ?", req.Email).First(&clash).Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "That email is already in use", "code": "DUPLICATE"})
	}

	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), 14)
	user := models.User{Email: req.Email, Password: hash, Role: "teacher"}
	if err := database.DB.Create(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the account"})
	}
	t := models.Teacher{
		UserID: user.ID, Name: strings.TrimSpace(req.Name),
		BranchID: req.BranchID, SchoolID: schoolID,
		Subject: strings.TrimSpace(req.Subject),
	}
	if err := database.DB.Create(&t).Error; err != nil {
		database.DB.Delete(&models.User{}, user.ID)
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the teacher"})
	}
	return c.JSON(t)
}
