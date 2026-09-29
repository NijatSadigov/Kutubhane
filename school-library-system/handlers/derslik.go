package handlers

import (
	"strings"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Dərslik — the textbook catalogue, the request cycle and the movement ledger.
//
// The cycle the school actually runs:
//
//	teacher asks  →  library checks and prepares  →  teacher is invited
//	              →  teacher collects  →  class holds them for the year
//	              →  extras and losses during the year  →  everything comes back
//
// Counting is per classroom, by quantity. What a class holds right now is
// derived from the movement ledger rather than kept as a running total, so the
// number and its own history can never disagree.

/* ------------------------------------------------------------- the stock */

// stockOf is where every copy of a title stands: how many are out with classes
// and how many no longer exist at all.
//
// A lost or written-off copy leaves the class *and* the stock — it is not on
// the shelf and never will be. Counting it as a return, which this did at
// first, quietly put phantom copies back on the shelf every time a child lost
// a book.
type textbookStock struct{ Out, WrittenOff int }

func stockByTextbook(branchID uint) map[uint]textbookStock {
	type row struct {
		TextbookID uint
		Kind       string
		Total      int
	}
	var rows []row
	database.DB.Model(&models.TextbookMovement{}).
		Select("textbook_id, kind, SUM(qty) as total").
		Where("branch_id = ?", branchID).
		Group("textbook_id, kind").
		Scan(&rows)

	out := map[uint]textbookStock{}
	for _, r := range rows {
		s := out[r.TextbookID]
		switch r.Kind {
		case models.MoveIssue:
			s.Out += r.Total
		case models.MoveReturn:
			s.Out -= r.Total
		case models.MoveLost, models.MoveDamaged:
			// gone from the class, and gone for good
			s.Out -= r.Total
			s.WrittenOff += r.Total
		}
		out[r.TextbookID] = s
	}
	for id, s := range out {
		if s.Out < 0 {
			s.Out = 0
			out[id] = s
		}
	}
	return out
}

// GetTextbooks is the branch's dərslik catalogue, with what is on the shelf.
func GetTextbooks(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}

	q := database.DB.Preload("Subject").Where("branch_id = ?", branchID)
	if g := c.QueryInt("grade"); g > 0 {
		q = q.Where("grade = ?", g)
	}
	if s := c.QueryInt("subject_id"); s > 0 {
		q = q.Where("subject_id = ?", s)
	}

	var books []models.Textbook
	q.Order("grade, title").Find(&books)

	stock := stockByTextbook(branchID)
	for i := range books {
		s := stock[books[i].ID]
		books[i].IssuedCopies = s.Out
		books[i].WrittenOffCopies = s.WrittenOff
		books[i].AvailableCopies = books[i].TotalCopies - s.Out - s.WrittenOff
		if books[i].AvailableCopies < 0 {
			books[i].AvailableCopies = 0
		}
	}
	return c.JSON(books)
}

func CreateTextbook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}
	var req models.Textbook
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if strings.TrimSpace(req.Title) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A title is required"})
	}
	if req.Grade < 1 {
		return c.Status(400).JSON(fiber.Map{"error": "A grade is required"})
	}
	book := models.Textbook{
		BranchID: branchID, SubjectID: req.SubjectID, Grade: req.Grade,
		Title: strings.TrimSpace(req.Title), Author: req.Author, Publisher: req.Publisher,
		Year: req.Year, ISBN: req.ISBN, PageCount: req.PageCount, CoverURL: req.CoverURL,
		Language: req.Language, Notes: req.Notes, TotalCopies: req.TotalCopies,
	}
	if err := database.DB.Create(&book).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the textbook"})
	}
	database.DB.Preload("Subject").First(&book, book.ID)
	return c.JSON(book)
}

func UpdateTextbook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}
	var book models.Textbook
	if err := database.DB.Where("id = ? AND branch_id = ?", c.Params("id"), branchID).
		First(&book).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Textbook not found"})
	}
	var req models.Textbook
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	database.DB.Model(&book).Updates(map[string]interface{}{
		"subject_id": req.SubjectID, "grade": req.Grade, "title": strings.TrimSpace(req.Title),
		"author": req.Author, "publisher": req.Publisher, "year": req.Year,
		"isbn": req.ISBN, "page_count": req.PageCount, "cover_url": req.CoverURL,
		"language": req.Language, "notes": req.Notes, "total_copies": req.TotalCopies,
	})
	database.DB.Preload("Subject").First(&book, book.ID)
	return c.JSON(book)
}

func DeleteTextbook(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}
	// A title with a history is not deletable: the ledger would lose its
	// meaning. Set its stock to zero instead.
	var n int64
	database.DB.Model(&models.TextbookMovement{}).
		Where("textbook_id = ?", c.Params("id")).Count(&n)
	if n > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "This textbook has movement history", "code": "IN_USE", "count": n})
	}
	database.DB.Where("branch_id = ?", branchID).Delete(&models.Textbook{}, c.Params("id"))
	return c.SendStatus(200)
}

/* ---------------------------------------------------------- the requests */

// TextbookRequestView carries the labels every screen needs.
type TextbookRequestView struct {
	models.TextbookRequest
	ClassLabel  string `json:"class_label"`
	TeacherName string `json:"teacher_name"`
	TotalBooks  int    `json:"total_books"`
}

func requestViews(reqs []models.TextbookRequest) []TextbookRequestView {
	ids := map[uint]bool{}
	branches := map[uint]bool{}
	for _, r := range reqs {
		ids[r.TeacherID] = true
		branches[r.BranchID] = true
	}
	people := ticketPeople(ids)

	// Fill in each line's live availability. The field is computed rather than
	// stored, so a textbook that arrives through a preload reads zero free —
	// which told the desk there was no stock at all, exactly when it is
	// deciding what it can afford to give.
	stock := map[uint]textbookStock{}
	for b := range branches {
		for id, s := range stockByTextbook(b) {
			stock[id] = s
		}
	}
	for i := range reqs {
		for j := range reqs[i].Lines {
			tb := &reqs[i].Lines[j].Textbook
			if tb.ID == 0 {
				continue
			}
			s := stock[tb.ID]
			tb.IssuedCopies = s.Out
			tb.WrittenOffCopies = s.WrittenOff
			tb.AvailableCopies = tb.TotalCopies - s.Out - s.WrittenOff
			if tb.AvailableCopies < 0 {
				tb.AvailableCopies = 0
			}
		}
	}

	out := make([]TextbookRequestView, 0, len(reqs))
	for _, r := range reqs {
		total := 0
		for _, l := range r.Lines {
			n := l.QtyApproved
			if n == 0 {
				n = l.QtyRequested
			}
			total += n
		}
		out = append(out, TextbookRequestView{
			TextbookRequest: r,
			ClassLabel:      r.Classroom.Label(),
			TeacherName:     people[r.TeacherID].name,
			TotalBooks:      total,
		})
	}
	return out
}

// teachesClassroom reports whether the caller takes that class. Staff pass
// regardless — the library has to be able to act on any class it serves.
func teachesClassroom(c *fiber.Ctx, classroomID uint) bool {
	role, _ := c.Locals("role").(string)
	if role != "teacher" {
		return true
	}
	uid, err := currentUserID(c)
	if err != nil {
		return false
	}
	var n int64
	database.DB.Table("classroom_teachers").
		Where("classroom_id = ? AND teacher_user_id = ?", classroomID, uid).Count(&n)
	return n > 0
}

// CreateTextbookRequest is the teacher's ask: which titles, how many of each,
// when they would collect and when they would bring them back.
func CreateTextbookRequest(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	var req struct {
		ClassroomID uint   `json:"classroom_id"`
		Kind        string `json:"kind"`
		PickupOn    string `json:"pickup_on"`
		ReturnBy    string `json:"return_by"`
		Note        string `json:"note"`
		Lines       []struct {
			TextbookID uint   `json:"textbook_id"`
			Qty        int    `json:"qty"`
			Note       string `json:"note"`
		} `json:"lines"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if req.Kind == "" {
		req.Kind = models.ReqInitial
	}
	if !models.ValidRequestKind(req.Kind) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid kind"})
	}
	if len(req.Lines) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Ask for at least one textbook", "code": "NO_LINES"})
	}

	var room models.Classroom
	if err := database.DB.First(&room, req.ClassroomID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Classroom not found"})
	}
	if !teachesClassroom(c, room.ID) {
		return c.Status(403).JSON(fiber.Map{"error": "You do not teach that class", "code": "NOT_YOURS"})
	}

	tr := models.TextbookRequest{
		BranchID: room.BranchID, SchoolID: room.SchoolID,
		ClassroomID: room.ID, AcademicYearID: room.AcademicYearID,
		TeacherID: uid, Kind: req.Kind, Status: models.ReqPending,
		Note: strings.TrimSpace(req.Note),
	}
	if d := parseDay(req.PickupOn); !d.IsZero() {
		tr.PickupOn = &d
	}
	if d := parseDay(req.ReturnBy); !d.IsZero() {
		tr.ReturnBy = &d
	}

	err = database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&tr).Error; err != nil {
			return err
		}
		for _, l := range req.Lines {
			if l.Qty < 1 {
				continue
			}
			var tb models.Textbook
			if tx.Where("id = ? AND branch_id = ?", l.TextbookID, room.BranchID).
				First(&tb).Error != nil {
				continue // not this branch's textbook; skip rather than fail the lot
			}
			if err := tx.Create(&models.TextbookRequestLine{
				RequestID: tr.ID, TextbookID: tb.ID,
				QtyRequested: l.Qty, Note: strings.TrimSpace(l.Note),
			}).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the request"})
	}

	database.DB.Preload("Lines.Textbook.Subject").Preload("Classroom").First(&tr, tr.ID)
	return c.JSON(requestViews([]models.TextbookRequest{tr})[0])
}

// GetTextbookRequests lists them. A teacher sees their own classes' requests;
// the library sees the branch's.
func GetTextbookRequests(c *fiber.Ctx) error {
	role, _ := c.Locals("role").(string)

	q := database.DB.
		Preload("Lines.Textbook.Subject").Preload("Classroom").Preload("AcademicYear")

	if role == "teacher" {
		uid, err := currentUserID(c)
		if err != nil {
			return err
		}
		q = q.Joins("JOIN classroom_teachers ct ON ct.classroom_id = textbook_requests.classroom_id").
			Where("ct.teacher_user_id = ?", uid)
	} else {
		branchID, err := getUserBranchID(c)
		if err != nil {
			return c.Status(403).JSON(fiber.Map{"error": err.Error()})
		}
		q = q.Where("textbook_requests.branch_id = ?", branchID)
	}

	switch s := c.Query("status"); s {
	case "":
	case "open":
		q = q.Where("textbook_requests.status IN ?", models.OpenRequestStatuses)
	default:
		q = q.Where("textbook_requests.status = ?", s)
	}
	if id := c.QueryInt("classroom_id"); id > 0 {
		q = q.Where("textbook_requests.classroom_id = ?", id)
	}

	var reqs []models.TextbookRequest
	q.Order("textbook_requests.created_at desc").Find(&reqs)
	return c.JSON(requestViews(reqs))
}

func GetTextbookRequest(c *fiber.Ctx) error {
	tr, err := loadRequest(c)
	if err != nil {
		return err
	}
	return c.JSON(requestViews([]models.TextbookRequest{*tr})[0])
}

func loadRequest(c *fiber.Ctx) (*models.TextbookRequest, error) {
	var tr models.TextbookRequest
	if err := database.DB.
		Preload("Lines.Textbook.Subject").Preload("Classroom").Preload("AcademicYear").
		First(&tr, c.Params("id")).Error; err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "Request not found")
	}
	role, _ := c.Locals("role").(string)
	if role == "teacher" {
		if !teachesClassroom(c, tr.ClassroomID) {
			return nil, fiber.NewError(fiber.StatusForbidden, "You do not teach that class")
		}
		return &tr, nil
	}
	branchID, err := getUserBranchID(c)
	if err != nil {
		return nil, fiber.NewError(fiber.StatusForbidden, err.Error())
	}
	if tr.BranchID != branchID {
		return nil, fiber.NewError(fiber.StatusForbidden, "That request belongs to another branch")
	}
	return &tr, nil
}

// CancelTextbookRequest lets the teacher withdraw one the library has not yet
// handed over.
func CancelTextbookRequest(c *fiber.Ctx) error {
	tr, err := loadRequest(c)
	if err != nil {
		return err
	}
	if tr.Status == models.ReqCollected {
		return c.Status(400).JSON(fiber.Map{"error": "These books have already been collected"})
	}
	database.DB.Model(tr).Update("status", models.ReqCancelled)
	return c.JSON(fiber.Map{"ok": true})
}

/* --------------------------------------------------- the library's side */

// HandleTextbookRequest is the desk working through the queue: accept it and
// start preparing, say it is ready to collect, or turn it down. Approved
// quantities may differ from what was asked — the shelf decides.
func HandleTextbookRequest(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}

	var tr models.TextbookRequest
	if err := database.DB.Preload("Lines").
		Where("id = ? AND branch_id = ?", c.Params("id"), branchID).
		First(&tr).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Request not found"})
	}

	var req struct {
		Status   string `json:"status"`
		DeskNote string `json:"desk_note"`
		PickupOn string `json:"pickup_on"`
		Lines    []struct {
			ID          uint `json:"id"`
			QtyApproved int  `json:"qty_approved"`
		} `json:"lines"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	switch req.Status {
	case models.ReqPreparing, models.ReqReady, models.ReqRejected, models.ReqPending:
	case "":
		req.Status = tr.Status
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
	}

	for _, l := range req.Lines {
		if l.QtyApproved < 0 {
			continue
		}
		database.DB.Model(&models.TextbookRequestLine{}).
			Where("id = ? AND request_id = ?", l.ID, tr.ID).
			Update("qty_approved", l.QtyApproved)
	}

	updates := map[string]interface{}{"status": req.Status, "handled_by": uid}
	if req.DeskNote != "" {
		updates["desk_note"] = strings.TrimSpace(req.DeskNote)
	}
	if d := parseDay(req.PickupOn); !d.IsZero() {
		updates["pickup_on"] = d
	}
	// Whether this save is the moment the request *becomes* ready, as opposed
	// to a save that leaves it ready. The teacher is told once; a librarian
	// correcting a desk note afterwards must not nudge them again.
	becameReady := req.Status == models.ReqReady && tr.Status != models.ReqReady

	if req.Status == models.ReqReady {
		now := time.Now()
		updates["ready_at"] = now
	}
	database.DB.Model(&tr).Updates(updates)

	database.DB.Preload("Lines.Textbook.Subject").Preload("Classroom").First(&tr, tr.ID)

	if becameReady {
		notify(tr.TeacherID, models.NotifyTextbookReady, models.NotifySubjectTextbookRequest, tr.ID,
			map[string]any{"class": tr.Classroom.Label(), "titles": len(tr.Lines)})
	}

	return c.JSON(requestViews([]models.TextbookRequest{tr})[0])
}

// IssueTextbookRequest hands the books over: the teacher has come and collected
// them. Each approved line becomes an ISSUE in the ledger, which is what makes
// the class hold them and the shelf lose them.
func IssueTextbookRequest(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}

	var tr models.TextbookRequest
	if err := database.DB.Preload("Lines").
		Where("id = ? AND branch_id = ?", c.Params("id"), branchID).
		First(&tr).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Request not found"})
	}
	if tr.Status == models.ReqCollected {
		return c.Status(400).JSON(fiber.Map{"error": "Already collected", "code": "DONE"})
	}
	if tr.Status == models.ReqRejected || tr.Status == models.ReqCancelled {
		return c.Status(400).JSON(fiber.Map{"error": "This request is closed"})
	}

	now := time.Now()
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		for _, l := range tr.Lines {
			qty := l.QtyApproved
			if qty == 0 {
				qty = l.QtyRequested
			}
			if qty < 1 {
				continue
			}
			if err := tx.Create(&models.TextbookMovement{
				BranchID: tr.BranchID, ClassroomID: tr.ClassroomID,
				TextbookID: l.TextbookID, AcademicYearID: tr.AcademicYearID,
				RequestID: &tr.ID, Kind: models.MoveIssue, Qty: qty,
				RecordedBy: uid,
			}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&tr).Updates(map[string]interface{}{
			"status": models.ReqCollected, "collected_at": now, "handled_by": uid,
		}).Error
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not issue the books"})
	}

	database.DB.Preload("Lines.Textbook.Subject").Preload("Classroom").First(&tr, tr.ID)
	return c.JSON(requestViews([]models.TextbookRequest{tr})[0])
}

/* ------------------------------------------------------- what a class holds */

// ClassroomHolding is one title a class currently has out.
type ClassroomHolding struct {
	TextbookID  uint   `json:"textbook_id"`
	Title       string `json:"title"`
	SubjectName string `json:"subject_name"`
	Grade       int    `json:"grade"`
	Issued      int    `json:"issued"`
	Returned    int    `json:"returned"`
	Lost        int    `json:"lost"`
	Damaged     int    `json:"damaged"`
	Outstanding int    `json:"outstanding"`
}

// GetClassroomHoldings is "what does 4-A have right now?", derived from the
// ledger so it always matches its own history.
func GetClassroomHoldings(c *fiber.Ctx) error {
	id := uint(c.QueryInt("classroom_id"))
	if id == 0 {
		if v, err := c.ParamsInt("id"); err == nil {
			id = uint(v)
		}
	}
	if id == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "classroom_id is required"})
	}
	if !teachesClassroom(c, id) {
		return c.Status(403).JSON(fiber.Map{"error": "You do not teach that class"})
	}

	q := database.DB.Preload("Textbook.Subject").Where("classroom_id = ?", id)
	if y := c.QueryInt("year_id"); y > 0 {
		q = q.Where("academic_year_id = ?", y)
	}
	var moves []models.TextbookMovement
	q.Find(&moves)

	byBook := map[uint]*ClassroomHolding{}
	for _, m := range moves {
		h, ok := byBook[m.TextbookID]
		if !ok {
			h = &ClassroomHolding{
				TextbookID: m.TextbookID, Title: m.Textbook.Title,
				SubjectName: m.Textbook.Subject.Name, Grade: m.Textbook.Grade,
			}
			byBook[m.TextbookID] = h
		}
		switch m.Kind {
		case models.MoveIssue:
			h.Issued += m.Qty
		case models.MoveReturn:
			h.Returned += m.Qty
		case models.MoveLost:
			h.Lost += m.Qty
		case models.MoveDamaged:
			h.Damaged += m.Qty
		}
	}

	out := make([]ClassroomHolding, 0, len(byBook))
	for _, h := range byBook {
		h.Outstanding = h.Issued - h.Returned - h.Lost - h.Damaged
		if h.Outstanding < 0 {
			h.Outstanding = 0
		}
		out = append(out, *h)
	}
	return c.JSON(out)
}

// RecordTextbookMovement books a return, a loss or a damaged copy against a
// class. This is the end-of-year collection and the mid-year exceptions both:
// the note is where the teacher names the student a loss belongs to.
func RecordTextbookMovement(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	var req struct {
		ClassroomID uint   `json:"classroom_id"`
		TextbookID  uint   `json:"textbook_id"`
		Kind        string `json:"kind"`
		Qty         int    `json:"qty"`
		Note        string `json:"note"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	switch req.Kind {
	case models.MoveReturn, models.MoveLost, models.MoveDamaged:
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid kind"})
	}
	if req.Qty < 1 {
		return c.Status(400).JSON(fiber.Map{"error": "A quantity is required"})
	}
	if !teachesClassroom(c, req.ClassroomID) {
		return c.Status(403).JSON(fiber.Map{"error": "You do not teach that class"})
	}

	var room models.Classroom
	if err := database.DB.First(&room, req.ClassroomID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Classroom not found"})
	}
	var tb models.Textbook
	if err := database.DB.Where("id = ? AND branch_id = ?", req.TextbookID, room.BranchID).
		First(&tb).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Textbook not found"})
	}

	// A class cannot give back more than it holds — that would make the shelf
	// count grow out of nowhere.
	held := outstandingFor(room.ID, tb.ID)
	if req.Qty > held {
		return c.Status(400).JSON(fiber.Map{
			"error": "That is more than the class is holding", "code": "TOO_MANY", "held": held})
	}

	m := models.TextbookMovement{
		BranchID: room.BranchID, ClassroomID: room.ID, TextbookID: tb.ID,
		AcademicYearID: room.AcademicYearID, Kind: req.Kind, Qty: req.Qty,
		Note: strings.TrimSpace(req.Note), RecordedBy: uid,
	}
	if err := database.DB.Create(&m).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not record it"})
	}
	return c.JSON(m)
}

func outstandingFor(classroomID, textbookID uint) int {
	type row struct {
		Kind  string
		Total int
	}
	var rows []row
	database.DB.Model(&models.TextbookMovement{}).
		Select("kind, SUM(qty) as total").
		Where("classroom_id = ? AND textbook_id = ?", classroomID, textbookID).
		Group("kind").Scan(&rows)
	n := 0
	for _, r := range rows {
		if r.Kind == models.MoveIssue {
			n += r.Total
		} else {
			n -= r.Total
		}
	}
	if n < 0 {
		return 0
	}
	return n
}

// GetTextbookMovements is the audit trail for a class or a title.
func GetTextbookMovements(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(403).JSON(fiber.Map{"error": err.Error()})
	}
	q := database.DB.Preload("Textbook").Preload("Classroom").Where("branch_id = ?", branchID)
	if id := c.QueryInt("classroom_id"); id > 0 {
		q = q.Where("classroom_id = ?", id)
	}
	if id := c.QueryInt("textbook_id"); id > 0 {
		q = q.Where("textbook_id = ?", id)
	}
	var moves []models.TextbookMovement
	q.Order("created_at desc").Limit(300).Find(&moves)
	return c.JSON(moves)
}

// openTextbookRequestCount is the staff nav badge.
func openTextbookRequestCount(branchID uint) int64 {
	var n int64
	database.DB.Model(&models.TextbookRequest{}).
		Where("branch_id = ? AND status IN ?", branchID, models.OpenRequestStatuses).
		Count(&n)
	return n
}
