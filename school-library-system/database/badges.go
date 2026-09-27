package database

import (
	"school-library-system/models"
)

// SeedBadges inserts the badge definitions from the design's badge grid. It is
// idempotent — matched on Code — so it runs safely at every boot, and editing a
// badge's wording here updates it on the next start.
//
// Colours, shapes and glyphs are taken from the handoff. The custom badge logos
// the designer mentioned can replace the glyphs later without touching this.
func SeedBadges() {
	badges := []models.Badge{
		{
			Code: "critic", Name: "Helpful Critic",
			Description: "10 reviews marked helpful by classmates",
			Glyph:       "❝", Shape: "shield",
			Fill: "#0F766E", Ring: "#99F6E4", Tint: "#F0FDFA", Ink: "#115E59",
			Tier: "Gold", Metric: "REVIEWS", Target: 10, Sort: 1,
		},
		{
			Code: "poly", Name: "Polyglot Reader",
			Description: "Finish books in 3 languages",
			Glyph:       "Aə", Shape: "circle",
			Fill: "#7C3AED", Ring: "#DDD6FE", Tint: "#F5F3FF", Ink: "#5B21B6",
			Metric: models.BadgeLangs, Target: 3, Sort: 2,
		},
		{
			Code: "classics", Name: "Classics Explorer",
			Description: "Read 5 books",
			Glyph:       "❦", Shape: "octa",
			Fill: "#BE123C", Ring: "#FECDD3", Tint: "#FFF1F2", Ink: "#9F1239",
			Metric: models.BadgeBooks, Target: 5, Sort: 3,
		},
		{
			Code: "streak", Name: "Streak Keeper",
			Description: "Read 7 days in a row",
			Glyph:       "7", Shape: "circle",
			Fill: "#EA580C", Ring: "#FED7AA", Tint: "#FFF7ED", Ink: "#9A3412",
			Tier: "Bronze", Metric: models.BadgeStreak, Target: 7, Sort: 4,
		},
		{
			Code: "streak30", Name: "Streak Master",
			Description: "Read 30 days in a row",
			Glyph:       "30", Shape: "circle",
			Fill: "#C2410C", Ring: "#FDBA74", Tint: "#FFF7ED", Ink: "#7C2D12",
			Tier: "Silver", Metric: models.BadgeStreak, Target: 30, Sort: 5,
		},
		{
			Code: "early", Name: "Early Bird",
			Description: "Return 5 books before the due date",
			Glyph:       "✧", Shape: "squircle",
			Fill: "#F2545B", Ring: "#FFD6CF", Tint: "#FFF5F5", Ink: "#B4232A",
			Metric: models.BadgeEarlyRet, Target: 5, Sort: 6,
		},
		{
			Code: "quiz", Name: "Quiz Ace",
			Description: "Pass 10 challenge quizzes",
			Glyph:       "✓", Shape: "shield",
			Fill: "#16A34A", Ring: "#BBF7D0", Tint: "#F0FDF4", Ink: "#166534",
			Metric: models.BadgeQuizzes, Target: 10, Sort: 7,
		},
		{
			Code: "pages1k", Name: "First Thousand",
			Description: "Conquer 1,000 pages",
			Glyph:       "△", Shape: "hex",
			Fill: "#78716C", Ring: "#E7E5E4", Tint: "#FAFAF9", Ink: "#44403C",
			Tier: "Bronze", Metric: models.BadgePages, Target: 1000, Sort: 8,
		},
		{
			Code: "pages", Name: "Page Mountain",
			Description: "Conquer 10,000 pages",
			Glyph:       "▲", Shape: "hex",
			Fill: "#57534E", Ring: "#E7E5E4", Tint: "#FAFAF9", Ink: "#44403C",
			Tier: "Gold", Metric: models.BadgePages, Target: 10000, Sort: 9,
		},
		{
			Code: "champ", Name: "Challenge Champion",
			Description: "Win a school challenge",
			Glyph:       "♛", Shape: "octa",
			Fill: "#CA8A04", Ring: "#FDE68A", Tint: "#FEFCE8", Ink: "#854D0E",
			Metric: "CHAMPION", Target: 1, Sort: 10,
		},
	}

	for _, b := range badges {
		var existing models.Badge
		if err := DB.Where("code = ?", b.Code).First(&existing).Error; err == nil {
			// Keep the id, refresh the wording and styling.
			b.ID = existing.ID
			DB.Model(&existing).Omit("id").Updates(b)
			continue
		}
		DB.Create(&b)
	}
}
