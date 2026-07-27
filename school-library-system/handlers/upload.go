package handlers

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Allowed file extensions per upload kind.
var uploadRules = map[string]struct {
	dir     string
	allowed map[string]bool
}{
	"cover": {dir: "uploads/covers", allowed: map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true}},
	"ebook": {dir: "uploads/ebooks", allowed: map[string]bool{".pdf": true}},
}

// UploadFile handles POST /api/upload/:kind (kind = "cover" | "ebook").
// It validates the extension, stores the file under a timestamped name, and
// returns a relative URL the client saves into the book's cover_url/ebook_url.
func UploadFile(c *fiber.Ctx) error {
	kind := c.Params("kind")
	rule, ok := uploadRules[kind]
	if !ok {
		return c.Status(400).JSON(fiber.Map{"error": "Unknown upload type"})
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file provided"})
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if !rule.allowed[ext] {
		return c.Status(400).JSON(fiber.Map{"error": "File type not allowed for this upload"})
	}

	if err := os.MkdirAll(rule.dir, 0o755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not prepare storage"})
	}

	// Timestamped, sanitized name avoids collisions and path traversal.
	base := sanitizeFilename(strings.TrimSuffix(filepath.Base(fileHeader.Filename), ext))
	name := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), base, ext)
	dest := filepath.Join(rule.dir, name)

	if err := c.SaveFile(fileHeader, dest); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Could not save file"})
	}

	// Forward slashes for the URL regardless of OS path separators.
	url := "/" + rule.dir + "/" + name
	return c.JSON(fiber.Map{"url": url, "filename": fileHeader.Filename})
}

// sanitizeFilename keeps only safe characters so the stored name is predictable.
func sanitizeFilename(s string) string {
	s = strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			return r
		default:
			return '-'
		}
	}, s)
	if s == "" {
		s = "file"
	}
	if len(s) > 60 {
		s = s[:60]
	}
	return s
}
