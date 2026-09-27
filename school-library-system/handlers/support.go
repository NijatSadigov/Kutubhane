package handlers

import (
	"strings"
	"time"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// Texniki dəstək — the librarian → school-administration ticket channel.
//
// Shaped after bookrequest.go, which solves the same problem one level down: a
// branch-scoped author, a school-scoped queue, and scope taken from the caller's
// own profile rather than the request body. Two differences worth knowing:
//
//   - a ticket carries a thread, so there is a reply endpoint on each side and a
//     denormalised ReplyCount/LastReplyAt so the list needs no join per row;
//   - the queue is read by two kinds of caller. A manager is the school
//     administrator and sees their own school; a platform admin has no school of
//     their own and sees every school's tickets.

/* ------------------------------------------------------------- scoping */

// librarianTicketScope resolves the branch and school a ticket author belongs
// to. A librarian profile carries both, so one lookup answers it.
func librarianTicketScope(c *fiber.Ctx) (branchID uint, schoolID uint, err error) {
	uid, err := currentUserID(c)
	if err != nil {
		return 0, 0, err
	}
	var lib models.Librarian
	if err := database.DB.Where("user_id = ?", uid).First(&lib).Error; err != nil {
		// An admin passes IsLibrarian but has no branch to raise a ticket from.
		return 0, 0, fiber.NewError(fiber.StatusForbidden, "Only a branch librarian can raise a ticket")
	}
	return lib.BranchID, lib.SchoolID, nil
}

// ticketQueueScope resolves which school's tickets the caller may read. A
// manager gets their own school; an admin gets every school (allSchools).
func ticketQueueScope(c *fiber.Ctx) (schoolID uint, allSchools bool, err error) {
	role, _ := c.Locals("role").(string)
	if role == "admin" {
		return 0, true, nil
	}
	schoolID, err = resolveManagerSchoolID(c)
	if err != nil {
		return 0, false, err
	}
	return schoolID, false, nil
}

/* --------------------------------------------------------------- views */

// TicketView is a ticket as a list row or a thread head: the stored record plus
// the author's display name and whether this caller has unread replies.
type TicketView struct {
	models.Ticket
	AuthorName string            `json:"author_name"`
	AuthorRole string            `json:"author_role"`
	BranchName string            `json:"branch_name"`
	SchoolName string            `json:"school_name"`
	Unread     bool              `json:"unread"`
	Replies    []TicketReplyView `json:"replies,omitempty"`
}

type TicketReplyView struct {
	ID         uint      `json:"id"`
	Body       string    `json:"body"`
	CreatedAt  time.Time `json:"created_at"`
	AuthorName string    `json:"author_name"`
	AuthorRole string    `json:"author_role"`
	IsMine     bool      `json:"is_mine"`
	// The administration's side of the thread, so the UI can align and badge it
	// without knowing anything about roles.
	FromAdmin bool `json:"from_admin"`
}

// ticketPeople resolves display names for a set of user ids. resolvePeople
// already does the work for students, librarians and managers; it renders a
// platform admin as "—" because reviews deliberately do not name one. A ticket
// thread does need to name them, so anyone it could not place falls back to the
// local part of their email.
func ticketPeople(ids map[uint]bool) map[uint]person {
	people := resolvePeople(ids)

	missing := make([]uint, 0)
	for id, p := range people {
		if p.name == "" || p.name == "—" {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		var users []models.User
		database.DB.Where("id IN ?", missing).Find(&users)
		for _, u := range users {
			name := u.Email
			if i := strings.IndexByte(name, '@'); i > 0 {
				name = name[:i]
			}
			people[u.ID] = person{name, "", u.Role}
		}
	}
	return people
}

// unreadFor reports whether the given side of a ticket has replies it has not
// seen. A ticket with no replies is never unread: the other side has read its
// own words by definition.
func unreadFor(t models.Ticket, admin bool) bool {
	if t.LastReplyAt == nil {
		return false
	}
	seen := t.AuthorSeenAt
	if admin {
		seen = t.AdminSeenAt
	}
	return seen == nil || t.LastReplyAt.After(*seen)
}

// ticketViews decorates a list of tickets for one caller.
func ticketViews(tickets []models.Ticket, admin bool) []TicketView {
	ids := map[uint]bool{}
	for _, t := range tickets {
		ids[t.AuthorID] = true
	}
	people := ticketPeople(ids)

	out := make([]TicketView, 0, len(tickets))
	for _, t := range tickets {
		p := people[t.AuthorID]
		out = append(out, TicketView{
			Ticket:     t,
			AuthorName: p.name,
			AuthorRole: p.role,
			BranchName: t.Branch.Name,
			SchoolName: t.School.Name,
			Unread:     unreadFor(t, admin),
		})
	}
	return out
}

// ticketThread loads one ticket's replies as views.
func ticketThread(t models.Ticket, me uint) []TicketReplyView {
	var replies []models.TicketReply
	database.DB.Where("ticket_id = ?", t.ID).Order("created_at asc").Find(&replies)
	if len(replies) == 0 {
		return nil
	}

	ids := map[uint]bool{}
	for _, r := range replies {
		ids[r.UserID] = true
	}
	people := ticketPeople(ids)

	out := make([]TicketReplyView, 0, len(replies))
	for _, r := range replies {
		p := people[r.UserID]
		out = append(out, TicketReplyView{
			ID: r.ID, Body: r.Body, CreatedAt: r.CreatedAt,
			AuthorName: p.name, AuthorRole: p.role,
			IsMine:    r.UserID == me,
			FromAdmin: p.role == "manager" || p.role == "admin",
		})
	}
	return out
}

/* ---------------------------------------------- librarian: raise & read */

// CreateTicket raises a ticket with the school administration. Branch and school
// come from the librarian's own profile.
func CreateTicket(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	branchID, schoolID, err := librarianTicketScope(c)
	if err != nil {
		return err
	}

	var req struct {
		Kind    string `json:"kind"`
		Subject string `json:"subject"`
		Body    string `json:"body"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	req.Subject = strings.TrimSpace(req.Subject)
	req.Body = strings.TrimSpace(req.Body)
	if req.Subject == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Subject is required"})
	}
	if req.Body == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Body is required"})
	}
	if req.Kind == "" {
		req.Kind = models.TicketOther
	}
	if !models.ValidTicketKind(req.Kind) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid kind"})
	}

	now := time.Now()
	t := models.Ticket{
		AuthorID: uid,
		BranchID: branchID,
		SchoolID: schoolID,
		Kind:     req.Kind,
		Subject:  req.Subject,
		Body:     req.Body,
		Status:   models.TicketOpen,
		// The author has seen their own opening message.
		AuthorSeenAt: &now,
	}
	if err := database.DB.Create(&t).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create ticket"})
	}
	return c.JSON(t)
}

// GetBranchTickets lists the tickets raised from the caller's own branch. A
// branch has one or two librarians who cover for each other, so the list is
// branch-wide rather than only the caller's own.
func GetBranchTickets(c *fiber.Ctx) error {
	branchID, _, err := librarianTicketScope(c)
	if err != nil {
		return err
	}

	q := database.DB.Preload("Branch").Preload("School").Where("branch_id = ?", branchID)
	if s := c.Query("status"); s != "" {
		if !models.ValidTicketStatus(s) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
		}
		q = q.Where("status = ?", s)
	}

	var tickets []models.Ticket
	q.Order("COALESCE(last_reply_at, created_at) desc").Find(&tickets)
	return c.JSON(ticketViews(tickets, false))
}

// GetTicket returns one ticket with its thread, for the branch that raised it.
func GetTicket(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	branchID, _, err := librarianTicketScope(c)
	if err != nil {
		return err
	}

	var t models.Ticket
	if err := database.DB.Preload("Branch").Preload("School").
		First(&t, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ticket not found"})
	}
	if t.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "This ticket belongs to another branch"})
	}

	views := ticketViews([]models.Ticket{t}, false)
	v := views[0]
	v.Replies = ticketThread(t, uid)
	return c.JSON(v)
}

// ReplyToTicket adds the author's side of the conversation.
func ReplyToTicket(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	branchID, _, err := librarianTicketScope(c)
	if err != nil {
		return err
	}

	var t models.Ticket
	if err := database.DB.First(&t, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ticket not found"})
	}
	if t.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "This ticket belongs to another branch"})
	}
	return appendTicketReply(c, &t, uid, false)
}

// CloseTicket lets the branch withdraw a ticket it no longer needs. The
// administration's own verdict is RESOLVED, set from the queue.
func CloseTicket(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	branchID, _, err := librarianTicketScope(c)
	if err != nil {
		return err
	}

	var t models.Ticket
	if err := database.DB.First(&t, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ticket not found"})
	}
	if t.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "This ticket belongs to another branch"})
	}

	now := time.Now()
	t.Status = models.TicketClosed
	t.ResolvedBy = &uid
	t.ResolvedAt = &now
	database.DB.Save(&t)
	return c.JSON(t)
}

// MarkTicketSeen stamps the author's side as caught up, which clears the badge.
func MarkTicketSeen(c *fiber.Ctx) error {
	branchID, _, err := librarianTicketScope(c)
	if err != nil {
		return err
	}

	var t models.Ticket
	if err := database.DB.First(&t, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Ticket not found"})
	}
	if t.BranchID != branchID {
		return c.Status(403).JSON(fiber.Map{"error": "This ticket belongs to another branch"})
	}

	now := time.Now()
	t.AuthorSeenAt = &now
	database.DB.Save(&t)
	return c.JSON(fiber.Map{"ok": true})
}

/* ------------------------------------------------ administration: queue */

// GetQueueTickets is the administration's queue. A manager sees their own
// school; a platform admin sees every school.
func GetQueueTickets(c *fiber.Ctx) error {
	schoolID, allSchools, err := ticketQueueScope(c)
	if err != nil {
		return err
	}

	q := database.DB.Preload("Branch").Preload("School")
	if !allSchools {
		q = q.Where("school_id = ?", schoolID)
	}
	switch s := c.Query("status"); s {
	case "":
		// no filter
	case "open":
		q = q.Where("status IN ?", models.TicketOpenStatuses)
	default:
		if !models.ValidTicketStatus(s) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
		}
		q = q.Where("status = ?", s)
	}

	var tickets []models.Ticket
	q.Order("COALESCE(last_reply_at, created_at) desc").Find(&tickets)
	return c.JSON(ticketViews(tickets, true))
}

// GetQueueTicket returns one ticket with its thread, for the administration.
func GetQueueTicket(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	t, err := queueTicket(c)
	if err != nil {
		return err
	}

	views := ticketViews([]models.Ticket{*t}, true)
	v := views[0]
	v.Replies = ticketThread(*t, uid)
	return c.JSON(v)
}

// UpdateQueueTicketStatus moves a ticket through the queue.
func UpdateQueueTicketStatus(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	t, err := queueTicket(c)
	if err != nil {
		return err
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if !models.ValidTicketStatus(req.Status) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
	}

	t.Status = req.Status
	if req.Status == models.TicketResolved || req.Status == models.TicketClosed {
		now := time.Now()
		t.ResolvedBy = &uid
		t.ResolvedAt = &now
	} else {
		t.ResolvedBy = nil
		t.ResolvedAt = nil
	}
	database.DB.Save(t)
	return c.JSON(t)
}

// ReplyToQueueTicket adds the administration's side of the conversation. An
// answer on an untouched ticket also moves it to IN_PROGRESS, so the queue
// reflects that somebody has picked it up.
func ReplyToQueueTicket(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	t, err := queueTicket(c)
	if err != nil {
		return err
	}
	return appendTicketReply(c, t, uid, true)
}

// MarkQueueTicketSeen stamps the administration's side as caught up.
func MarkQueueTicketSeen(c *fiber.Ctx) error {
	t, err := queueTicket(c)
	if err != nil {
		return err
	}
	now := time.Now()
	t.AdminSeenAt = &now
	database.DB.Save(t)
	return c.JSON(fiber.Map{"ok": true})
}

// queueTicket loads the :id ticket and checks it is inside the caller's scope.
func queueTicket(c *fiber.Ctx) (*models.Ticket, error) {
	schoolID, allSchools, err := ticketQueueScope(c)
	if err != nil {
		return nil, err
	}

	var t models.Ticket
	if err := database.DB.Preload("Branch").Preload("School").
		First(&t, c.Params("id")).Error; err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "Ticket not found")
	}
	if !allSchools && t.SchoolID != schoolID {
		return nil, fiber.NewError(fiber.StatusForbidden, "This ticket belongs to another school")
	}
	return &t, nil
}

/* ---------------------------------------------------------- shared write */

// appendTicketReply writes one message into a thread and maintains the
// denormalised counters and the writer's own "seen" stamp — the writer has read
// what they just wrote, so only the other side's badge lights up.
func appendTicketReply(c *fiber.Ctx, t *models.Ticket, uid uint, fromAdmin bool) error {
	var req struct {
		Body string `json:"body"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Body is required"})
	}
	if t.Status == models.TicketClosed {
		return c.Status(400).JSON(fiber.Map{"error": "This ticket is closed"})
	}

	reply := models.TicketReply{TicketID: t.ID, UserID: uid, Body: req.Body}
	if err := database.DB.Create(&reply).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save reply"})
	}

	now := time.Now()
	t.ReplyCount++
	t.LastReplyAt = &now
	if fromAdmin {
		t.AdminSeenAt = &now
		// Answering an untouched ticket is picking it up.
		if t.Status == models.TicketOpen {
			t.Status = models.TicketInProgress
		}
	} else {
		t.AuthorSeenAt = &now
	}
	database.DB.Save(t)

	return c.JSON(reply)
}

/* ----------------------------------------------------------- nav badges */

// unreadTicketsForLibrarian counts the caller's branch tickets carrying replies
// the branch has not read. It is one of the desk summary's badge numbers, so it
// stays quiet on failure rather than breaking the whole summary.
func unreadTicketsForLibrarian(c *fiber.Ctx) int {
	branchID, _, err := librarianTicketScope(c)
	if err != nil {
		return 0
	}
	var tickets []models.Ticket
	database.DB.
		Where("branch_id = ? AND last_reply_at IS NOT NULL", branchID).
		Where("author_seen_at IS NULL OR last_reply_at > author_seen_at").
		Find(&tickets)
	return len(tickets)
}
