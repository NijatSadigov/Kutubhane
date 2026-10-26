package middleware

import (
	"strings"

	"school-library-system/config"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// SecretKey is sourced from JWT_SECRET (see config package), not hardcoded.
var SecretKey = config.JWTSecret

// IsAuthenticated is the only place a token is parsed and the only place one is
// judged. Everything downstream reads the role it puts in Locals.
func IsAuthenticated(c *fiber.Ctx) error {
	tokenString := c.Cookies("jwt")

	if tokenString == "" {
		authHeader := c.Get("Authorization")
		if len(authHeader) > 7 && strings.ToUpper(authHeader[:6]) == "BEARER" {
			tokenString = authHeader[7:]
		}
	}

	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthenticated"})
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(SecretKey), nil
	})

	if err != nil || !token.Valid {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Invalid Token"})
	}

	claims := token.Claims.(jwt.MapClaims)

	c.Locals("user_id", claims["iss"])
	c.Locals("role", claims["role"])

	return c.Next()
}

// requireRole admits a caller whose role is one of `allowed`.
//
// It reads the role from Locals rather than parsing the token again. The four
// role gates below each used to re-parse it like this:
//
//	token, _ := jwt.Parse(...)   // error discarded
//	if token == nil { 401 }      // never nil for a well-formed token
//	claims, _ := token.Claims.(jwt.MapClaims)
//	if claims["role"] != "admin" { 403 }
//
// jwt.Parse returns a populated token *and* an error when a signature does not
// verify, so that sequence read the role out of a forged token and admitted it.
// Nothing was actually exposed, because every one of these is registered inside
// the api group and IsAuthenticated rejects the token first — but only the
// registration site made that true, and nothing here said so. One route
// registered on `app` instead of `api` would have turned it into a hole.
//
// Reading Locals cannot fail open: the key is set only by IsAuthenticated, and
// only after it has validated the signature and the expiry. No role in Locals
// means no valid token, which is a 401.
func requireRole(c *fiber.Ctx, message string, allowed ...string) error {
	role, ok := c.Locals("role").(string)
	if !ok || role == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"message": "Unauthenticated"})
	}
	for _, a := range allowed {
		if role == a {
			return c.Next()
		}
	}
	return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
		"message":   message,
		"your_role": role,
	})
}

// IsAdmin admits a platform admin only. Note that an admin has no profile row,
// so every /manager/* handler refuses them — see resolveManagerSchoolID.
func IsAdmin(c *fiber.Ctx) error {
	return requireRole(c, "Admins Only", "admin")
}

// IsManager admits a school administrator and a platform admin.
func IsManager(c *fiber.Ctx) error {
	return requireRole(c, "Managers Only", "manager", "admin")
}

// IsTeacher gates the dərslik screens a teacher drives. A librarian is admitted
// too: in a small school the same person often does both, and every handler
// still scopes to the classrooms the caller actually teaches.
func IsTeacher(c *fiber.Ctx) error {
	return requireRole(c, "Teachers Only", "teacher", "librarian", "manager", "admin")
}

// IsLibrarian gates the branch's own desk, members and settings. A school
// administrator is deliberately not admitted — they do not run a branch's
// desk; the Məktəb domain in the console is their read-only view of one.
func IsLibrarian(c *fiber.Ctx) error {
	return requireRole(c, "Librarians Only", "librarian", "admin")
}
