package handlers

import (
	"school-library-system/catalog"
	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// ==========================================
// AUTHORS
// ==========================================

func GetAuthors(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	var authors []models.Author
	// 100% Dynamic Counting: Counts books automatically!
	database.DB.Select("authors.*, (SELECT count(*) FROM books WHERE books.author_id = authors.id) as book_count").
		Where("branch_id = ?", branchID).Find(&authors)
	return c.JSON(authors)
}

func CreateAuthor(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var author models.Author
	if err := c.BodyParser(&author); err != nil {
		return c.Status(400).SendString("Invalid Input")
	}
	author.BranchID = branchID
	database.DB.Create(&author)
	return c.JSON(author)
}

func UpdateAuthor(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.Author
	c.BodyParser(&req)

	var author models.Author
	if err := database.DB.First(&author, id).Error; err != nil {
		return c.SendStatus(404)
	}
	author.Name = req.Name
	database.DB.Save(&author)
	return c.JSON(author)
}

func DeleteAuthor(c *fiber.Ctx) error {
	database.DB.Delete(&models.Author{}, c.Params("id"))
	return c.SendStatus(200)
}

// ==========================================
// PUBLISHERS
// ==========================================

func GetPublishers(c *fiber.Ctx) error {
	branchID, err := getUserBranchID(c)
	if err != nil {
		return c.Status(401).JSON(fiber.Map{"error": err.Error()})
	}
	var publishers []models.Publisher
	database.DB.Select("publishers.*, (SELECT count(*) FROM books WHERE books.publisher_id = publishers.id) as book_count").
		Where("branch_id = ?", branchID).Find(&publishers)
	return c.JSON(publishers)
}

func CreatePublisher(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var pub models.Publisher
	c.BodyParser(&pub)
	pub.BranchID = branchID
	database.DB.Create(&pub)
	return c.JSON(pub)
}

func UpdatePublisher(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.Publisher
	c.BodyParser(&req)

	var pub models.Publisher
	if err := database.DB.First(&pub, id).Error; err != nil {
		return c.SendStatus(404)
	}
	pub.Name = req.Name
	pub.Location = req.Location
	database.DB.Save(&pub)
	return c.JSON(pub)
}

func DeletePublisher(c *fiber.Ctx) error {
	database.DB.Delete(&models.Publisher{}, c.Params("id"))
	return c.SendStatus(200)
}

// ==========================================
// TOPICS
// ==========================================

// Genre and topic are global catalog facts, not branch lists.
//
// They were branch-scoped until 2026-09-28, which meant one branch's "Roman"
// and another's were different rows that no query could join — cross-branch
// filtering and the genre mix on Discover both broke the moment a second branch
// catalogued anything. The shelf a genre lives on is the part that is genuinely
// branch-local, and that stays on the old rows.
//
// book_count therefore counts across every branch, through the works that carry
// the genre, rather than the holdings of the caller's own branch.

func GetTopics(c *fiber.Ctx) error {
	var topics []models.CatalogTopic
	database.DB.
		Select(`catalog_topics.*, (SELECT count(*) FROM books
		          JOIN editions ON editions.id = books.edition_id
		          JOIN works ON works.id = editions.work_id
		         WHERE works.topic_id = catalog_topics.id) as book_count`).
		Order("name").Find(&topics)
	return c.JSON(topics)
}

func CreateTopic(c *fiber.Ctx) error {
	var req models.CatalogTopic
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	id, err := catalog.FindOrCreateTopic(database.DB, req.Name)
	if err != nil || id == nil {
		return c.Status(400).JSON(fiber.Map{"error": "A name is required"})
	}
	var t models.CatalogTopic
	database.DB.First(&t, *id)
	return c.JSON(t)
}

func UpdateTopic(c *fiber.Ctx) error {
	var req models.CatalogTopic
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	var t models.CatalogTopic
	if err := database.DB.First(&t, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Topic not found"})
	}
	key := catalog.NormalizeKey(req.Name)
	if key == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A name is required"})
	}
	// Renaming onto an existing name would create the duplicate this whole
	// change exists to remove.
	var clash models.CatalogTopic
	if database.DB.Where("name_key = ? AND id <> ?", key, t.ID).First(&clash).Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Another topic already uses that name", "code": "DUPLICATE"})
	}
	t.Name, t.NameKey = req.Name, key
	database.DB.Save(&t)
	return c.JSON(t)
}

func DeleteTopic(c *fiber.Ctx) error {
	if n := worksUsingTopic(c.Params("id")); n > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "This topic is still used by books", "code": "IN_USE", "count": n})
	}
	database.DB.Delete(&models.CatalogTopic{}, c.Params("id"))
	return c.SendStatus(200)
}

// ==========================================
// GENRES
// ==========================================

func GetGenres(c *fiber.Ctx) error {
	var genres []models.CatalogGenre
	database.DB.
		Select(`catalog_genres.*, (SELECT count(*) FROM books
		          JOIN editions ON editions.id = books.edition_id
		          JOIN works ON works.id = editions.work_id
		         WHERE works.genre_id = catalog_genres.id) as book_count`).
		Order("name").Find(&genres)
	return c.JSON(genres)
}

func CreateGenre(c *fiber.Ctx) error {
	var req models.CatalogGenre
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	id, err := catalog.FindOrCreateGenre(database.DB, req.Name)
	if err != nil || id == nil {
		return c.Status(400).JSON(fiber.Map{"error": "A name is required"})
	}
	var g models.CatalogGenre
	database.DB.First(&g, *id)
	return c.JSON(g)
}

func UpdateGenre(c *fiber.Ctx) error {
	var req models.CatalogGenre
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid Input"})
	}
	var g models.CatalogGenre
	if err := database.DB.First(&g, c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Genre not found"})
	}
	key := catalog.NormalizeKey(req.Name)
	if key == "" {
		return c.Status(400).JSON(fiber.Map{"error": "A name is required"})
	}
	var clash models.CatalogGenre
	if database.DB.Where("name_key = ? AND id <> ?", key, g.ID).First(&clash).Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Another genre already uses that name", "code": "DUPLICATE"})
	}
	g.Name, g.NameKey = req.Name, key
	database.DB.Save(&g)
	return c.JSON(g)
}

func DeleteGenre(c *fiber.Ctx) error {
	if n := worksUsingGenre(c.Params("id")); n > 0 {
		return c.Status(400).JSON(fiber.Map{
			"error": "This genre is still used by books", "code": "IN_USE", "count": n})
	}
	database.DB.Delete(&models.CatalogGenre{}, c.Params("id"))
	return c.SendStatus(200)
}

// A global list is shared, so deleting a row a librarian in another branch is
// relying on has to be refused rather than silently blanking their books.
func worksUsingGenre(id string) int64 {
	var n int64
	database.DB.Model(&models.Work{}).Where("genre_id = ?", id).Count(&n)
	return n
}

func worksUsingTopic(id string) int64 {
	var n int64
	database.DB.Model(&models.Work{}).Where("topic_id = ?", id).Count(&n)
	return n
}

// ==========================================
// FREQUENCIES (Süreli Yayın Türleri)
// ==========================================

func GetFrequencies(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var freqs []models.Frequency
	database.DB.Where("branch_id = ?", branchID).Find(&freqs)
	return c.JSON(freqs)
}

func CreateFrequency(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var freq models.Frequency
	c.BodyParser(&freq)
	freq.BranchID = branchID
	database.DB.Create(&freq)
	return c.JSON(freq)
}

func UpdateFrequency(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.Frequency
	c.BodyParser(&req)

	var freq models.Frequency
	database.DB.First(&freq, id)
	freq.Type = req.Type
	database.DB.Save(&freq)
	return c.JSON(freq)
}

func DeleteFrequency(c *fiber.Ctx) error {
	database.DB.Delete(&models.Frequency{}, c.Params("id"))
	return c.SendStatus(200)
}

// ==========================================
// CONDITIONS (Fiziksel Durumlar)
// ==========================================

func GetCopyConditions(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var conds []models.CopyCondition
	database.DB.Where("branch_id = ?", branchID).Find(&conds)
	return c.JSON(conds)
}

func CreateCopyCondition(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var cond models.CopyCondition
	c.BodyParser(&cond)
	cond.BranchID = branchID
	database.DB.Create(&cond)
	return c.JSON(cond)
}

func UpdateCopyCondition(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.CopyCondition
	c.BodyParser(&req)

	var cond models.CopyCondition
	database.DB.First(&cond, id)
	cond.Name = req.Name
	database.DB.Save(&cond)
	return c.JSON(cond)
}

func DeleteCopyCondition(c *fiber.Ctx) error {
	database.DB.Delete(&models.CopyCondition{}, c.Params("id"))
	return c.SendStatus(200)
}

// ==========================================
// COPY STATUSES (Demirbaş Durumu)
// ==========================================

func GetCopyStatuses(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var statuses []models.CopyStatus
	database.DB.Where("branch_id = ?", branchID).Find(&statuses)
	return c.JSON(statuses)
}

func CreateCopyStatus(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var status models.CopyStatus
	c.BodyParser(&status)
	status.BranchID = branchID
	status.Code = "" // Custom statuses never get a system code
	database.DB.Create(&status)
	return c.JSON(status)
}

func UpdateCopyStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.CopyStatus
	c.BodyParser(&req)

	var status models.CopyStatus
	database.DB.First(&status, id)
	status.Name = req.Name // Update Name ONLY. System Code stays untouched!
	database.DB.Save(&status)
	return c.JSON(status)
}

func DeleteCopyStatus(c *fiber.Ctx) error {
	var status models.CopyStatus
	database.DB.First(&status, c.Params("id"))

	// SECURITY: Prevent deleting Core System Statuses
	if status.Code != "" {
		return c.Status(403).JSON(fiber.Map{"error": "You cannot delete a core system status. You may only rename it."})
	}

	database.DB.Delete(&status)
	return c.SendStatus(200)
}

// ==========================================
// LOAN STATUSES (Ödünç Durumları)
// ==========================================

func GetLoanStatuses(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var statuses []models.LoanStatus
	database.DB.Where("branch_id = ?", branchID).Find(&statuses)
	return c.JSON(statuses)
}

func CreateLoanStatus(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var status models.LoanStatus
	c.BodyParser(&status)
	status.BranchID = branchID
	status.Code = ""
	database.DB.Create(&status)
	return c.JSON(status)
}

func UpdateLoanStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.LoanStatus
	c.BodyParser(&req)

	var status models.LoanStatus
	database.DB.First(&status, id)
	status.Name = req.Name
	database.DB.Save(&status)
	return c.JSON(status)
}

func DeleteLoanStatus(c *fiber.Ctx) error {
	var status models.LoanStatus
	database.DB.First(&status, c.Params("id"))

	if status.Code != "" {
		return c.Status(403).JSON(fiber.Map{"error": "You cannot delete a core system status. You may only rename it."})
	}

	database.DB.Delete(&status)
	return c.SendStatus(200)
}

// ==========================================
// RESERVATION STATUSES (Rezervasyon Durumları)
// ==========================================

func GetReservationStatuses(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var statuses []models.ReservationStatus
	database.DB.Where("branch_id = ?", branchID).Find(&statuses)
	return c.JSON(statuses)
}

func CreateReservationStatus(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var status models.ReservationStatus
	c.BodyParser(&status)
	status.BranchID = branchID
	status.Code = ""
	database.DB.Create(&status)
	return c.JSON(status)
}

func UpdateReservationStatus(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.ReservationStatus
	c.BodyParser(&req)

	var status models.ReservationStatus
	database.DB.First(&status, id)
	status.Name = req.Name
	database.DB.Save(&status)
	return c.JSON(status)
}

func DeleteReservationStatus(c *fiber.Ctx) error {
	var status models.ReservationStatus
	database.DB.First(&status, c.Params("id"))

	if status.Code != "" {
		return c.Status(403).JSON(fiber.Map{"error": "You cannot delete a core system status. You may only rename it."})
	}

	database.DB.Delete(&status)
	return c.SendStatus(200)
}
