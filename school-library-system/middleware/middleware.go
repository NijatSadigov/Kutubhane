package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

const SecretKey = "secret"

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

func IsAdmin(c *fiber.Ctx) error {

	tokenString := c.Cookies("jwt")
	if tokenString == "" {
		authHeader := c.Get("Authorization")
		if len(authHeader) > 7 {
			tokenString = authHeader[7:]
		}
	}

	if tokenString == "" {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	token, _ := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(SecretKey), nil
	})

	if token == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return c.SendStatus(fiber.StatusUnauthorized)
	}

	if claims["role"] != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"message":   "Admins Only",
			"your_role": claims["role"],
		})
	}

	return c.Next()
}

func IsLibrarian(c *fiber.Ctx) error {
	tokenString := c.Cookies("jwt")
	if tokenString == "" {
		authHeader := c.Get("Authorization")
		if len(authHeader) > 7 {
			tokenString = authHeader[7:]
		}
	}

	token, _ := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(SecretKey), nil
	})

	if token == nil {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	claims, _ := token.Claims.(jwt.MapClaims)

	if claims["role"] != "librarian" && claims["role"] != "admin" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"message": "Librarians Only"})
	}

	return c.Next()
}
