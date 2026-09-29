package handlers

import (
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// Who a project is for.
//
// The rule that matters is not "can the caller edit this project" — findProject
// already answered that — but "may the caller point it at *these people*". A
// librarian runs one branch, so they may aim a campaign at their own branch and
// the classes inside it and nothing else. Letting the audience be set from a
// request body without that check would be a way to reach another branch's
// children through a screen that never shows them.
//
// Partner schools are admitted structurally and refused to everyone except a
// platform admin, because deciding that two schools are partners is the
// alliance work in Phase 3. Until that exists there is nothing to check a
// school administrator's choice against, and an unchecked choice here is a
// tenancy hole rather than a feature.

// SetProjectAudience replaces a project's target group.
func SetProjectAudience(c *fiber.Ctx) error {
	p, err := findProject(c)
	if err != nil {
		return err
	}
	role, _ := c.Locals("role").(string)

	var req struct {
		Audience     string `json:"audience"`
		BranchIDs    []uint `json:"branch_ids"`
		ClassroomIDs []uint `json:"classroom_ids"`
		SchoolIDs    []uint `json:"school_ids"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	if !models.ValidAudience(req.Audience) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid audience"})
	}

	// The branch a branch-scoped caller is confined to; 0 for the
	// administration, who may aim anywhere inside their own school.
	_, callerBranch, err := projectScope(c)
	if err != nil {
		return err
	}

	switch req.Audience {
	case models.AudienceBranches:
		if len(req.BranchIDs) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "Name at least one branch", "code": "EMPTY_AUDIENCE"})
		}
		var branches []models.Branch
		database.DB.Where("id IN ? AND school_id = ?", req.BranchIDs, p.SchoolID).Find(&branches)
		if len(branches) != len(req.BranchIDs) {
			return c.Status(400).JSON(fiber.Map{
				"error": "A branch does not belong to this school", "code": "BAD_BRANCH"})
		}
		if callerBranch != 0 {
			for _, b := range branches {
				if b.ID != callerBranch {
					return c.Status(403).JSON(fiber.Map{
						"error": "You can only aim a project at your own branch",
						"code":  "OUTSIDE_BRANCH"})
				}
			}
		}
		if err := database.DB.Model(p).Association("Branches").Replace(branches); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not save the branches"})
		}

	case models.AudienceClasses:
		if len(req.ClassroomIDs) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "Name at least one class", "code": "EMPTY_AUDIENCE"})
		}
		var rooms []models.Classroom
		database.DB.Where("id IN ? AND school_id = ?", req.ClassroomIDs, p.SchoolID).Find(&rooms)
		if len(rooms) != len(req.ClassroomIDs) {
			return c.Status(400).JSON(fiber.Map{
				"error": "A class does not belong to this school", "code": "BAD_CLASS"})
		}
		if callerBranch != 0 {
			for _, r := range rooms {
				if r.BranchID != callerBranch {
					return c.Status(403).JSON(fiber.Map{
						"error": "You can only aim a project at your own branch's classes",
						"code":  "OUTSIDE_BRANCH"})
				}
			}
		}
		if err := database.DB.Model(p).Association("Classrooms").Replace(rooms); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not save the classes"})
		}

	case models.AudienceSchools:
		// See the note at the top: until alliances exist, only a platform
		// admin may name another school.
		if role != "admin" {
			return c.Status(403).JSON(fiber.Map{
				"error": "Reaching another school needs an alliance, which does not exist yet",
				"code":  "NO_ALLIANCES"})
		}
		if len(req.SchoolIDs) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "Name at least one school", "code": "EMPTY_AUDIENCE"})
		}
		var schools []models.School
		database.DB.Where("id IN ?", req.SchoolIDs).Find(&schools)
		if len(schools) != len(req.SchoolIDs) {
			return c.Status(400).JSON(fiber.Map{"error": "A school does not exist", "code": "BAD_SCHOOL"})
		}
		if err := database.DB.Model(p).Association("Schools").Replace(schools); err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Could not save the schools"})
		}
	}

	database.DB.Model(p).Update("audience", req.Audience)

	// A reading list's visibility follows the audience, so the challenge
	// behind the project is re-pinned whenever the audience moves. One branch
	// is expressible as Challenge.BranchID; anything wider is school-scoped
	// there and narrowed at read time by the project's own audience.
	syncChallengeScope(p, req.Audience)

	database.DB.Preload("Classrooms").Preload("Branches").Preload("Schools").First(p, p.ID)
	return c.JSON(projectViews([]models.Project{*p}, false)[0])
}

// syncChallengeScope keeps the challenge behind a project pointing at the same
// people the project does, as far as a challenge can express it.
func syncChallengeScope(p *models.Project, audience string) {
	if p.ChallengeID == nil {
		return
	}
	var branchID *uint
	if audience == models.AudienceBranches {
		var ids []uint
		database.DB.Table("project_branches").
			Where("project_id = ?", p.ID).Pluck("branch_id", &ids)
		if len(ids) == 1 {
			branchID = &ids[0]
		}
	}
	database.DB.Model(&models.Challenge{}).Where("id = ?", *p.ChallengeID).
		Update("branch_id", branchID)
}

/* ----------------------------------------------- who may see a campaign */

// readerGroup is where a reader stands: their school, their branch and the
// class they sit in. Everything an audience is checked against.
type readerGroup struct {
	schoolID    uint
	branchID    uint
	classroomID *uint
}

func groupOf(uid uint) (readerGroup, bool) {
	var s models.Student
	if err := database.DB.Preload("Branch").Where("user_id = ?", uid).First(&s).Error; err != nil {
		return readerGroup{}, false
	}
	return readerGroup{
		schoolID: s.Branch.SchoolID, branchID: s.BranchID, classroomID: s.ClassroomID,
	}, true
}

// projectAudienceAllows reports whether a reader is inside a project's target
// group. Loaded per project rather than per reader because the lists are tiny
// and a school has a handful of campaigns running at once.
func projectAudienceAllows(p models.Project, g readerGroup) bool {
	switch p.Audience {
	case models.AudienceBranches:
		var n int64
		database.DB.Table("project_branches").
			Where("project_id = ? AND branch_id = ?", p.ID, g.branchID).Count(&n)
		return n > 0

	case models.AudienceClasses:
		// A reader with no class is not in a class-targeted campaign. That is
		// the honest answer rather than showing it to everyone unplaced.
		if g.classroomID == nil {
			return false
		}
		var n int64
		database.DB.Table("project_classrooms").
			Where("project_id = ? AND classroom_id = ?", p.ID, *g.classroomID).Count(&n)
		return n > 0

	case models.AudienceSchools:
		if p.SchoolID == g.schoolID {
			return true
		}
		var n int64
		database.DB.Table("project_schools").
			Where("project_id = ? AND school_id = ?", p.ID, g.schoolID).Count(&n)
		return n > 0

	default: // SCHOOL
		return p.SchoolID == g.schoolID
	}
}

// visibleChallenge answers, for one challenge, whether this reader should see
// it at all.
//
// A challenge with no project behind it is a plain challenge and keeps the
// behaviour it always had: school-wide, unless it names a branch. That branch
// was being ignored before this — ListChallenges filtered on school alone — so
// a campaign aimed at one branch was shown to the whole school. Honouring it
// is what makes a project's target group mean anything to a reader.
func visibleChallenge(ch models.Challenge, byChallenge map[uint]models.Project, g readerGroup) bool {
	if p, ok := byChallenge[ch.ID]; ok {
		return projectAudienceAllows(p, g)
	}
	if ch.BranchID != nil {
		return *ch.BranchID == g.branchID
	}
	return true
}

// projectsByChallenge indexes the projects behind a set of challenges, so the
// list handler resolves them in one query rather than one per row.
func projectsByChallenge(challengeIDs []uint) map[uint]models.Project {
	out := map[uint]models.Project{}
	if len(challengeIDs) == 0 {
		return out
	}
	var ps []models.Project
	database.DB.Where("challenge_id IN ?", challengeIDs).Find(&ps)
	for _, p := range ps {
		if p.ChallengeID != nil {
			out[*p.ChallengeID] = p
		}
	}
	return out
}
