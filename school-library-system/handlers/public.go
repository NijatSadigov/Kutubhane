package handlers

import (
	"sort"
	"strconv"

	"school-library-system/database"
	"school-library-system/models"

	"github.com/gofiber/fiber/v2"
)

// GetPublicStats returns aggregate, non-identifying reading statistics for the
// public landing page: per-school counts plus platform totals. It is intentionally
// registered OUTSIDE the auth group and exposes no student PII — only counts.
func GetPublicStats(c *fiber.Ctx) error {
	var schools []models.School
	if err := database.DB.Preload("Branches").Order("name asc").Find(&schools).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load schools"})
	}

	type SchoolStat struct {
		ID        uint   `json:"id"`
		Name      string `json:"name"`
		Address   string `json:"address"`
		Branches  int    `json:"branches"`
		Students  int64  `json:"students"`
		Books     int64  `json:"books"`
		BooksRead int64  `json:"books_read"`
		PagesRead int64  `json:"pages_read"`
	}

	out := []SchoolStat{}
	var tStudents, tBooks, tBooksRead, tPages int64
	tBranches := 0

	for _, s := range schools {
		branchIDs := make([]uint, 0, len(s.Branches))
		for _, b := range s.Branches {
			branchIDs = append(branchIDs, b.ID)
		}

		var students, books, booksRead, pages int64
		if len(branchIDs) > 0 {
			database.DB.Model(&models.Student{}).Where("branch_id IN ?", branchIDs).Count(&students)
			database.DB.Model(&models.Book{}).Where("branch_id IN ?", branchIDs).Count(&books)

			readQ := database.DB.Model(&models.Loan{}).
				Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
				Joins("JOIN books ON books.id = book_copies.book_id").
				Where("books.branch_id IN ? AND loans.return_date IS NOT NULL", branchIDs)
			readQ.Count(&booksRead)

			database.DB.Model(&models.Loan{}).
				Joins("JOIN book_copies ON book_copies.id = loans.book_copy_id").
				Joins("JOIN books ON books.id = book_copies.book_id").
				Where("books.branch_id IN ? AND loans.return_date IS NOT NULL", branchIDs).
				Select("COALESCE(SUM(books.page_count),0)").
				Scan(&pages)
		}

		out = append(out, SchoolStat{
			ID: s.ID, Name: s.Name, Address: s.Address,
			Branches: len(s.Branches), Students: students, Books: books,
			BooksRead: booksRead, PagesRead: pages,
		})

		tBranches += len(s.Branches)
		tStudents += students
		tBooks += books
		tBooksRead += booksRead
		tPages += pages
	}

	return c.JSON(fiber.Map{
		"totals": fiber.Map{
			"schools":    len(schools),
			"branches":   tBranches,
			"students":   tStudents,
			"books":      tBooks,
			"books_read": tBooksRead,
			"pages_read": tPages,
		},
		"schools": out,
	})
}

/* --------------------------------------------------- the logged-out site */

// The public surface. A visitor who is not signed in can look through the
// catalogue and read what school readers thought of a book — the design's
// guest persona — but never sees who wrote what. Authorship is reduced to
// initials by maskReviewAuthors, and nothing here exposes a loan, a shelf or
// a reservation.

// GetPublicCatalogue browses the shared catalogue with no session. It is the
// global scope only: "my library" and "my shelf" have no meaning for a guest.
func GetPublicCatalogue(c *fiber.Ctx) error {
	c.Request().URI().QueryArgs().Set("scope", "global")
	return BrowseCatalogue(c)
}

// GetPublicWorkReviews lists a work's reviews for a guest, masked.
func GetPublicWorkReviews(c *fiber.Ctx) error {
	workID, err := strconv.Atoi(c.Params("id"))
	if err != nil || workID <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid work id"})
	}

	var reviews []models.Review
	if err := database.DB.
		Where("work_id = ? AND hidden = false", workID).
		Order("created_at desc").Find(&reviews).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not load reviews"})
	}

	views := maskReviewAuthors(decorateReviews(reviews, 0, true))
	sort.SliceStable(views, func(i, j int) bool { return views[i].Helpful > views[j].Helpful })
	agg, hist := ratingAggregate(uint(workID))

	return c.JSON(fiber.Map{
		"reviews": views, "rating": agg.avg, "count": agg.n,
		"histogram": hist, "mine": nil, "masked": true,
	})
}

// GetPublicReviews backs the landing page's "fresh from the community" strip:
// the most recent reviews from every partner school, masked, each with the
// book it is about.
func GetPublicReviews(c *fiber.Ctx) error {
	limit, _ := strconv.Atoi(c.Query("limit", "3"))
	if limit <= 0 || limit > 12 {
		limit = 3
	}

	var reviews []models.Review
	database.DB.Where("hidden = false AND text <> ''").
		Order("created_at desc").Limit(limit).Find(&reviews)
	if len(reviews) == 0 {
		return c.JSON([]fiber.Map{})
	}

	views := maskReviewAuthors(decorateReviews(reviews, 0, false))

	workIDs := make([]uint, 0, len(views))
	for _, v := range views {
		workIDs = append(workIDs, v.WorkID)
	}
	var works []models.Work
	database.DB.Where("id IN ?", workIDs).Find(&works)
	title := map[uint]string{}
	for _, w := range works {
		title[w.ID] = w.Title
	}
	var eds []models.Edition
	database.DB.Where("work_id IN ?", workIDs).Order("id").Find(&eds)
	cover, edID := map[uint]string{}, map[uint]uint{}
	for _, e := range eds {
		if _, ok := edID[e.WorkID]; !ok {
			edID[e.WorkID] = e.ID
		}
		if e.CoverURL != "" && cover[e.WorkID] == "" {
			cover[e.WorkID] = e.CoverURL
		}
	}

	// The reader's school, which is as specific as a public page gets.
	out := make([]fiber.Map, 0, len(views))
	for _, v := range views {
		out = append(out, fiber.Map{
			"id": v.ID, "rating": v.Rating, "text": v.Text, "spoiler": v.Spoiler,
			"author_initials": v.AuthorInitials, "created_at": v.CreatedAt,
			"work_id": v.WorkID, "edition_id": edID[v.WorkID],
			"title": title[v.WorkID], "cover_url": cover[v.WorkID],
		})
	}
	return c.JSON(out)
}
