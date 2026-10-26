// Command createadmin makes the first platform admin on a fresh installation.
//
// It exists because there is no sign-up for staff and there must not be: the
// public /api/register creates readers from a branch's invite link and nothing
// else. Until this command, a new deployment's first admin was a hand-written
// INSERT with a bcrypt hash generated somewhere else, which is both tedious
// and the sort of step people shorten by reusing a password.
//
// Usage:
//
//	go run ./cmd/createadmin -email you@school.az
//	go run ./cmd/createadmin -email you@school.az -password '...'
//
// Without -password it generates one and prints it once. It is printed to
// stdout and never stored anywhere but the bcrypt hash in the database, so
// copy it before closing the terminal.
//
// Point it at the deployment's database the usual way:
//
//	DATABASE_DSN="host=... dbname=school_library" go run ./cmd/createadmin -email ...
package main

import (
	"crypto/rand"
	"encoding/base64"
	"flag"
	"fmt"
	"os"
	"strings"

	"school-library-system/database"
	"school-library-system/models"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	email := flag.String("email", "", "the admin's e-mail; this is their login")
	password := flag.String("password", "", "password; generated and printed if omitted")
	flag.Parse()

	if strings.TrimSpace(*email) == "" {
		fmt.Fprintln(os.Stderr, "-email is required")
		flag.Usage()
		os.Exit(2)
	}

	database.Connect()
	database.DB.AutoMigrate(&models.User{})

	// A second admin is a reasonable thing to want; a duplicate e-mail is not,
	// and the database would refuse it with a less helpful message.
	var existing models.User
	if err := database.DB.Where("email = ?", *email).First(&existing).Error; err == nil {
		fmt.Fprintf(os.Stderr, "%s already exists (role %q). Nothing changed.\n", *email, existing.Role)
		os.Exit(1)
	}

	pw := *password
	generated := false
	if pw == "" {
		pw = generatePassword()
		generated = true
	} else if len(pw) < 8 {
		fmt.Fprintln(os.Stderr, "the password must be at least 8 characters")
		os.Exit(2)
	}

	// Cost 14, the same as every other account in this system — a login that
	// is cheaper to crack than the others is the one that gets cracked.
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), 14)
	if err != nil {
		fmt.Fprintln(os.Stderr, "could not hash the password:", err)
		os.Exit(1)
	}

	// A platform admin has no profile row — no Librarian, no Manager. That is
	// what distinguishes them, and what every /manager/* endpoint trips over:
	// see resolveManagerSchoolID and the note in TODO.md. It is also why there
	// is no -name here: models.User has no name of its own, and the console
	// shows an admin by their e-mail.
	user := models.User{Email: *email, Password: hash, Role: "admin"}
	if err := database.DB.Create(&user).Error; err != nil {
		fmt.Fprintln(os.Stderr, "could not create the account:", err)
		os.Exit(1)
	}

	fmt.Printf("created platform admin %s (id %d)\n", user.Email, user.ID)
	if generated {
		fmt.Printf("password: %s\n", pw)
		fmt.Println("This is the only time it is shown. Change it after signing in.")
	}
	fmt.Println("Sign in, then build the school at /staff/school-settings.")
}

// generatePassword returns 24 random characters. Base64 of 18 bytes, which is
// long enough that nobody will try to remember it — a password manager or a
// change after first sign-in is the intended path.
func generatePassword() string {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		fmt.Fprintln(os.Stderr, "could not read random bytes:", err)
		os.Exit(1)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
