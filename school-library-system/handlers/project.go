package handlers

import (
	"strings"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Layihələr — the school's reading projects and campaigns.
//
// Scope works the way Challenge's does rather than inventing a third
// convention: the school owns a project, and BranchID narrows it to one
// branch. A librarian sees their branch's projects plus the school-wide ones,
// because a school-wide campaign is theirs to run too; the administration sees
// every project in the school.
//
// Progress is summed from the update log on read and never stored. The same
// rule as the textbook ledger, for the same reason.

// ProjectView is a project with the numbers a screen needs, none of which are
// columns: what it has achieved, how far that is towards the goal, and how
// each class is doing if classes are keeping score.
type ProjectView struct {
	models.Project
	Progress    int             `json:"progress"`
	Percent     int             `json:"percent"`
	UpdateCount int             `json:"update_count"`
	BranchName  string          `json:"branch_name"`
	Standings   []ClassStanding `json:"standings,omitempty"`
}

// ClassStanding is one class's contribution — a group-by over the log rather
// than a tally anybody has to keep up to date.
type ClassStanding struct {
	ClassroomID uint   `json:"classroom_id"`
	Label       string `json:"label"`
	Amount      int    `json:"amount"`
}

// projectScope resolves who may see what. Returns the school, and the branch a
// branch-scoped caller is limited to (0 for the administration, who see all).
func projectScope(c *fiber.Ctx) (schoolID uint, branchID uint, err error) {
	schoolID, err = callerSchoolID(c)
	if err != nil {
		return 0, 0, err
	}
	role, _ := c.Locals("role").(string)
	if role == "librarian" || role == "teacher" {
		b, err := getUserBranchID(c)
		if err != nil {
			return 0, 0, fiber.NewError(fiber.StatusForbidden, err.Error())
		}
		return schoolID, b, nil
	}
	return schoolID, 0, nil
}

// GetProjects lists what the caller may see, newest first.
func GetProjects(c *fiber.Ctx) error {
	schoolID, branchID, err := projectScope(c)
	if err != nil {
		return err
	}

	q := database.DB.Preload("Classrooms").Where("school_id = ?", schoolID)
	if branchID != 0 {
		// A branch sees its own and the school's, not another branch's.
		q = q.Where("branch_id IS NULL OR branch_id = ?", branchID)
	}
	switch s := c.Query("status"); s {
	case "":
	case "open":
		q = q.Where("status IN ?", models.ProjectOpenStatuses)
	default:
		if !models.ValidProjectStatus(s) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
		}
		q = q.Where("status = ?", s)
	}
	if k := c.Query("kind"); k != "" {
		if !models.ValidProjectKind(k) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid kind"})
		}
		q = q.Where("kind = ?", k)
	}

	var rows []models.Project
	q.Order("created_at desc").Find(&rows)
	return c.JSON(projectViews(rows, false))
}

// GetProject is one project with its log and, when classes are taking part,
// the standings.
func GetProject(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	database.DB.Preload("Classrooms").
		Preload("Updates", func(db *gorm.DB) *gorm.DB { return db.Order("created_at desc") }).
		Preload("Updates.Classroom").
		First(p, p.ID)
	return c.JSON(projectViews([]models.Project{*p}, true)[0])
}

func CreateProject(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	schoolID, branchID, err := projectScope(c)
	if err != nil {
		return err
	}

	var req struct {
		Kind        string `json:"kind"`
		Title       string `json:"title"`
		Description string `json:"description"`
		StartsOn    string `json:"starts_on"`
		EndsOn      string `json:"ends_on"`
		GoalTarget  int    `json:"goal_target"`
		GoalUnit    string `json:"goal_unit"`
		// Whether the whole school is running it. A branch-scoped caller can
		// only raise a school-wide project if they say so explicitly.
		SchoolWide bool `json:"school_wide"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A title is required"})
	}
	if req.Kind == "" {
		req.Kind = models.ProjectCampaign
	}
	if !models.ValidProjectKind(req.Kind) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid kind"})
	}
	if req.GoalTarget < 0 {
		return c.Status(400).JSON(fiber.Map{"error": "A goal cannot be negative"})
	}
	// A number with nothing being counted is not a goal anybody can read.
	if req.GoalTarget > 0 && strings.TrimSpace(req.GoalUnit) == "" {
		return c.Status(400).JSON(fiber.Map{
			"error": "Say what the goal counts", "code": "UNIT_REQUIRED"})
	}

	p := models.Project{
		SchoolID: schoolID, Kind: req.Kind,
		Title: req.Title, Description: strings.TrimSpace(req.Description),
		Status:     models.ProjectPlanned,
		GoalTarget: req.GoalTarget, GoalUnit: strings.TrimSpace(req.GoalUnit),
		CreatedBy: uid,
	}
	if branchID != 0 && !req.SchoolWide {
		p.BranchID = &branchID
	}
	if d := parseDay(req.StartsOn); !d.IsZero() {
		p.StartsOn = &d
	}
	if d := parseDay(req.EndsOn); !d.IsZero() {
		p.EndsOn = &d
	}
	if p.StartsOn != nil && p.EndsOn != nil && p.EndsOn.Before(*p.StartsOn) {
		return c.Status(400).JSON(fiber.Map{
			"error": "It cannot end before it starts", "code": "BAD_DATES"})
	}

	if err := database.DB.Create(&p).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not create the project"})
	}
	return c.JSON(projectViews([]models.Project{p}, false)[0])
}

func UpdateProject(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		Kind        *string `json:"kind"`
		GoalTarget  *int    `json:"goal_target"`
		GoalUnit    *string `json:"goal_unit"`
		StartsOn    *string `json:"starts_on"`
		EndsOn      *string `json:"ends_on"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	updates := map[string]any{}
	if req.Title != nil {
		if strings.TrimSpace(*req.Title) == "" {
			return c.Status(400).JSON(fiber.Map{"error": "A title is required"})
		}
		updates["title"] = strings.TrimSpace(*req.Title)
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.Status != nil {
		if !models.ValidProjectStatus(*req.Status) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid status"})
		}
		updates["status"] = *req.Status
	}
	if req.Kind != nil {
		if !models.ValidProjectKind(*req.Kind) {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid kind"})
		}
		updates["kind"] = *req.Kind
	}
	if req.GoalTarget != nil {
		if *req.GoalTarget < 0 {
			return c.Status(400).JSON(fiber.Map{"error": "A goal cannot be negative"})
		}
		updates["goal_target"] = *req.GoalTarget
	}
	if req.GoalUnit != nil {
		updates["goal_unit"] = strings.TrimSpace(*req.GoalUnit)
	}
	if req.StartsOn != nil {
		if d := parseDay(*req.StartsOn); !d.IsZero() {
			updates["starts_on"] = d
		}
	}
	if req.EndsOn != nil {
		if d := parseDay(*req.EndsOn); !d.IsZero() {
			updates["ends_on"] = d
		}
	}
	if len(updates) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Nothing to change"})
	}

	database.DB.Model(p).Updates(updates)
	database.DB.Preload("Classrooms").First(p, p.ID)
	return c.JSON(projectViews([]models.Project{*p}, false)[0])
}

func DeleteProject(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	// A project that ran and is finished is a record, not clutter; only one
	// that never started can be deleted outright. The rest are CANCELLED.
	if p.Status != models.ProjectPlanned {
		return c.Status(400).JSON(fiber.Map{
			"error": "A project that has started is cancelled, not deleted",
			"code":  "CANCEL_INSTEAD"})
	}
	database.DB.Delete(p)
	return c.JSON(fiber.Map{"deleted": true})
}

// AddProjectUpdate records something that happened, and with it whatever it
// contributed towards the goal. This is the only thing that moves progress.
func AddProjectUpdate(c *fiber.Ctx) error {
	uid, err := currentUserID(c)
	if err != nil {
		return err
	}
	p, err := findProject(c)
	if err != nil {
		return err
	}
	if p.Status == models.ProjectDone || p.Status == models.ProjectCancelled {
		return c.Status(400).JSON(fiber.Map{
			"error": "This project is closed", "code": "CLOSED"})
	}

	var req struct {
		Body        string `json:"body"`
		Amount      int    `json:"amount"`
		ClassroomID *uint  `json:"classroom_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	req.Body = strings.TrimSpace(req.Body)
	// An update that says nothing and counts nothing is not an update.
	if req.Body == "" && req.Amount == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Write something, or record an amount"})
	}

	if req.ClassroomID != nil {
		var room models.Classroom
		if err := database.DB.Where("id = ? AND school_id = ?", *req.ClassroomID, p.SchoolID).
			First(&room).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Classroom not found"})
		}
	}

	u := models.ProjectUpdate{
		ProjectID: p.ID, Body: req.Body, Amount: req.Amount,
		ClassroomID: req.ClassroomID, RecordedBy: uid,
	}
	if err := database.DB.Create(&u).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not record it"})
	}
	database.DB.Preload("Classroom").First(&u, u.ID)
	return c.JSON(u)
}

// SetProjectClassrooms replaces which classes are taking part.
func SetProjectClassrooms(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	var req struct {
		ClassroomIDs []uint `json:"classroom_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}

	var rooms []models.Classroom
	if len(req.ClassroomIDs) > 0 {
		database.DB.Where("id IN ? AND school_id = ?", req.ClassroomIDs, p.SchoolID).Find(&rooms)
		if len(rooms) != len(req.ClassroomIDs) {
			return c.Status(400).JSON(fiber.Map{
				"error": "A class does not belong to this school", "code": "BAD_CLASS"})
		}
	}
	if err := database.DB.Model(p).Association("Classrooms").Replace(rooms); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save the classes"})
	}
	database.DB.Preload("Classrooms").First(p, p.ID)
	return c.JSON(projectViews([]models.Project{*p}, false)[0])
}

/* ------------------------------------------------------------- internals */

// findProject loads a project the caller is allowed to touch, so every handler
// above gets the scope check for free rather than each repeating it.
func findProject(c *fiber.Ctx) (*models.Project, error) {
	schoolID, branchID, err := projectScope(c)
	if err != nil {
		return nil, err
	}
	q := database.DB.Where("id = ? AND school_id = ?", c.Params("id"), schoolID)
	if branchID != 0 {
		q = q.Where("branch_id IS NULL OR branch_id = ?", branchID)
	}
	var p models.Project
	if err := q.First(&p).Error; err != nil {
		return nil, fiber.NewError(fiber.StatusNotFound, "Project not found")
	}
	return &p, nil
}

// projectViews sums the log into the numbers the screens want. One query for
// every project's totals rather than one per row.
func projectViews(rows []models.Project, withStandings bool) []ProjectView {
	ids := make([]uint, 0, len(rows))
	for _, p := range rows {
		ids = append(ids, p.ID)
	}

	progress := map[uint]int{}
	counts := map[uint]int{}
	if len(ids) > 0 {
		var agg []struct {
			ProjectID uint
			Total     int
			N         int
		}
		database.DB.Model(&models.ProjectUpdate{}).
			Select("project_id, COALESCE(SUM(amount),0) as total, COUNT(*) as n").
			Where("project_id IN ?", ids).Group("project_id").Scan(&agg)
		for _, a := range agg {
			progress[a.ProjectID] = a.Total
			counts[a.ProjectID] = a.N
		}
	}

	branchNames := map[uint]string{}
	var branches []models.Branch
	database.DB.Find(&branches)
	for _, b := range branches {
		branchNames[b.ID] = b.Name
	}

	out := make([]ProjectView, 0, len(rows))
	for _, p := range rows {
		v := ProjectView{
			Project: p, Progress: progress[p.ID], UpdateCount: counts[p.ID],
		}
		if p.BranchID != nil {
			v.BranchName = branchNames[*p.BranchID]
		}
		if p.GoalTarget > 0 {
			v.Percent = v.Progress * 100 / p.GoalTarget
			if v.Percent > 100 {
				// A campaign that beat its goal is reported as having beaten
				// it, not as 340% of a bar that only goes to 100.
				v.Percent = 100
			}
		}
		if withStandings {
			v.Standings = classStandings(p.ID)
		}
		out = append(out, v)
	}
	return out
}

// classStandings is the class-against-class scoreboard: a group-by over the
// log, so it cannot disagree with the updates it is built from.
func classStandings(projectID uint) []ClassStanding {
	var agg []struct {
		ClassroomID uint
		Total       int
	}
	database.DB.Model(&models.ProjectUpdate{}).
		Select("classroom_id, COALESCE(SUM(amount),0) as total").
		Where("project_id = ? AND classroom_id IS NOT NULL", projectID).
		Group("classroom_id").Order("total desc").Scan(&agg)
	if len(agg) == 0 {
		return nil
	}

	ids := make([]uint, 0, len(agg))
	for _, a := range agg {
		ids = append(ids, a.ClassroomID)
	}
	var rooms []models.Classroom
	database.DB.Where("id IN ?", ids).Find(&rooms)
	labels := map[uint]string{}
	for _, r := range rooms {
		labels[r.ID] = r.Label()
	}

	out := make([]ClassStanding, 0, len(agg))
	for _, a := range agg {
		out = append(out, ClassStanding{
			ClassroomID: a.ClassroomID, Label: labels[a.ClassroomID], Amount: a.Total,
		})
	}
	return out
}

// projectBadgeCount is the nav badge: projects still being run.
func projectBadgeCount(c *fiber.Ctx) int {
	schoolID, branchID, err := projectScope(c)
	if err != nil {
		return 0
	}
	q := database.DB.Model(&models.Project{}).
		Where("school_id = ? AND status IN ?", schoolID, models.ProjectOpenStatuses)
	if branchID != 0 {
		q = q.Where("branch_id IS NULL OR branch_id = ?", branchID)
	}
	var n int64
	q.Count(&n)
	return int(n)
}
