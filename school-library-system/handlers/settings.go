package handlers

import (
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

func GetTopics(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var topics []models.Topic
	database.DB.Select("topics.*, (SELECT count(*) FROM books WHERE books.topic_id = topics.id) as book_count").
		Where("branch_id = ?", branchID).Find(&topics)
	return c.JSON(topics)
}

func CreateTopic(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var topic models.Topic
	c.BodyParser(&topic)
	topic.BranchID = branchID
	database.DB.Create(&topic)
	return c.JSON(topic)
}

func UpdateTopic(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.Topic
	c.BodyParser(&req)

	var topic models.Topic
	database.DB.First(&topic, id)
	topic.Name = req.Name
	topic.Location = req.Location
	database.DB.Save(&topic)
	return c.JSON(topic)
}

func DeleteTopic(c *fiber.Ctx) error {
	database.DB.Delete(&models.Topic{}, c.Params("id"))
	return c.SendStatus(200)
}

// ==========================================
// GENRES
// ==========================================

func GetGenres(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var genres []models.Genre
	database.DB.Select("genres.*, (SELECT count(*) FROM books WHERE books.genre_id = genres.id) as book_count").
		Where("branch_id = ?", branchID).Find(&genres)
	return c.JSON(genres)
}

func CreateGenre(c *fiber.Ctx) error {
	branchID, _ := getUserBranchID(c)
	var genre models.Genre
	c.BodyParser(&genre)
	genre.BranchID = branchID
	database.DB.Create(&genre)
	return c.JSON(genre)
}

func UpdateGenre(c *fiber.Ctx) error {
	id := c.Params("id")
	var req models.Genre
	c.BodyParser(&req)

	var genre models.Genre
	database.DB.First(&genre, id)
	genre.Name = req.Name
	genre.Location = req.Location
	database.DB.Save(&genre)
	return c.JSON(genre)
}

func DeleteGenre(c *fiber.Ctx) error {
	database.DB.Delete(&models.Genre{}, c.Params("id"))
	return c.SendStatus(200)
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
