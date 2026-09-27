// Command apiaudit exercises every read endpoint against a running server as
// each role, and checks that the write endpoints reject callers who should not
// reach them.
//
// It is a smoke test, not a unit test: it runs against whatever server is on
// BASE (default http://localhost:8000) using the demo logins, and reports
// anything that answers differently from what the route table implies.
//
//	go run ./cmd/apiaudit
//	BASE=http://localhost:8000 go run ./cmd/apiaudit
//
// Read-only by default. Pass -writes to also exercise create/update/delete on
// a few endpoints; those run against whatever database the server is using, so
// only do that against a scratch DB.
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

type creds struct{ email, password string }

var logins = map[string]creds{
	"admin":     {"admin@school.com", "Test1234"},
	"manager":   {"mgr@hadaf.com", "Test1234"},
	"librarian": {"fatma@lib.com", "Test1234"},
	"student":   {"nicat@stu.com", "Test1234"},
}

// check is one expectation: calling `path` as `role` should return `want`.
type check struct {
	role   string
	method string
	path   string
	want   []int // any of these is a pass
	note   string
}

var base = envOr("BASE", "http://localhost:8000")

func main() {
	doWrites := flag.Bool("writes", false, "also exercise write endpoints (mutates data)")
	flag.Parse()

	tokens := map[string]string{}
	for role, c := range logins {
		tok, err := login(c)
		if err != nil {
			fmt.Printf("FATAL: cannot log in as %s: %v\n", role, err)
			os.Exit(1)
		}
		tokens[role] = tok
	}
	fmt.Printf("logged in as %d roles against %s\n\n", len(tokens), base)

	checks := readChecks()
	if *doWrites {
		checks = append(checks, writeChecks()...)
	}

	var failures []string
	byRole := map[string][2]int{} // [pass, total]

	for _, ch := range checks {
		code, body := call(ch.method, ch.path, tokens[ch.role], nil)
		ok := false
		for _, w := range ch.want {
			if code == w {
				ok = true
				break
			}
		}
		st := byRole[ch.role]
		st[1]++
		if ok {
			st[0]++
		} else {
			msg := fmt.Sprintf("%-9s %-6s %-44s got %d, want %v", ch.role, ch.method, ch.path, code, ch.want)
			if ch.note != "" {
				msg += "  (" + ch.note + ")"
			}
			if len(body) > 0 && len(body) < 160 {
				msg += "\n            body: " + strings.TrimSpace(string(body))
			}
			failures = append(failures, msg)
		}
		byRole[ch.role] = st
	}

	roles := make([]string, 0, len(byRole))
	for r := range byRole {
		roles = append(roles, r)
	}
	sort.Strings(roles)
	for _, r := range roles {
		fmt.Printf("  %-10s %3d/%-3d passed\n", r, byRole[r][0], byRole[r][1])
	}

	fmt.Println()
	if len(failures) == 0 {
		fmt.Printf("ALL %d CHECKS PASSED\n", len(checks))
		return
	}
	fmt.Printf("%d FAILURES:\n", len(failures))
	for _, f := range failures {
		fmt.Println("  " + f)
	}
	os.Exit(1)
}

// readChecks covers every GET in the route table, for the roles that should
// reach it and at least one role that should not.
func readChecks() []check {
	ok := []int{200}
	denied := []int{401, 403}

	var cs []check
	add := func(role, path string, want []int, note string) {
		cs = append(cs, check{role: role, method: "GET", path: path, want: want, note: note})
	}

	// --- public, no auth needed (sent with no token) ---
	add("", "/api/public/stats", ok, "")
	add("", "/api/public/books?limit=4", ok, "")
	add("", "/api/registration-tokens/validate/definitely-not-a-token", []int{400, 404}, "unknown token must not 200")

	// --- session ---
	for _, r := range []string{"admin", "manager", "librarian", "student"} {
		add(r, "/api/user", ok, "")
	}

	// --- shared catalogue: every signed-in role ---
	for _, r := range []string{"admin", "manager", "librarian", "student"} {
		add(r, "/api/catalog/search?q=orwell", ok, "")
		add(r, "/api/catalog/browse?scope=global", ok, "")
		add(r, "/api/catalog/editions/1", ok, "")
	}
	add("student", "/api/catalog/browse?scope=library", ok, "")
	add("librarian", "/api/catalog/browse?scope=library&cefr=B2&sort=newest", ok, "")
	add("student", "/api/catalog/browse?scope=shelf", []int{501}, "shelf is not built yet and must say so")

	// --- community ---
	for _, r := range []string{"student", "librarian", "manager"} {
		add(r, "/api/community/trending?days=30", ok, "")
		add(r, "/api/community/readers?days=30", ok, "")
		add(r, "/api/community/league?days=30", ok, "")
	}

	// --- student-facing ---
	add("student", "/api/books", ok, "")
	add("student", "/api/books/1", ok, "")
	add("student", "/api/my-library/5", ok, "own library")
	add("student", "/api/student/5/stats", ok, "own stats")
	add("student", "/api/student/5/reading", ok, "own diary")
	add("student", "/api/student/5/holds", ok, "own holds")
	add("student", "/api/book-requests/mine", ok, "")
	// another student in the same branch must be refused
	add("student", "/api/my-library/11", denied, "another student's library")
	add("student", "/api/student/11/stats", denied, "another student's stats")
	add("student", "/api/student/11/reading", denied, "another student's diary")
	add("student", "/api/student/11/holds", denied, "another student's holds")
	add("student", "/api/my-library/abc", []int{400}, "malformed id")

	// --- librarian ---
	for _, p := range []string{
		"/api/loans", "/api/reservations", "/api/class-list", "/api/book-requests",
		"/api/authors", "/api/publishers", "/api/topics", "/api/genres", "/api/frequencies",
		"/api/copy-conditions", "/api/copy-statuses", "/api/loan-statuses", "/api/reservation-statuses",
		"/api/registration-tokens", "/api/branch-settings", "/api/loan-limit",
	} {
		add("librarian", p, ok, "")
		add("student", p, denied, "student must not reach librarian data")
	}
	add("librarian", "/api/my-library/11", ok, "own-branch student")
	add("librarian", "/api/student/11/stats", ok, "own-branch student")

	// --- circulation desk ---
	add("librarian", "/api/desk/summary", ok, "")
	add("student", "/api/desk/summary", denied, "students must not see the desk")
	add("", "/api/desk/summary", []int{401}, "desk needs a session")

	// --- manager ---
	for _, p := range []string{
		"/api/manager/school", "/api/manager/students", "/api/manager/librarian-stats",
		"/api/manager/book-requests", "/api/manager/branch/1/books",
		"/api/manager/branch/1/loans", "/api/manager/branch/1/reservations",
	} {
		add("manager", p, ok, "")
		add("librarian", p, denied, "librarian must not reach manager data")
		add("student", p, denied, "student must not reach manager data")
	}

	// --- my shelf ---
	for _, r := range []string{"student", "librarian"} {
		add(r, "/api/shelf", ok, "")
		add(r, "/api/shelf/summary", ok, "")
		add(r, "/api/shelf/badges", ok, "")
		add(r, "/api/notes", ok, "")
	}
	add("student", "/api/shelf?status=WANT", ok, "")
	add("", "/api/shelf", []int{401}, "shelf needs a session")
	add("", "/api/notes", []int{401}, "notes are private")

	// --- challenges ---
	for _, r := range []string{"student", "librarian", "manager"} {
		add(r, "/api/challenges", ok, "")
	}
	add("student", "/api/challenges/99999", []int{404}, "unknown challenge")
	add("", "/api/challenges", []int{401}, "challenges need a session")

	// --- admin ---
	add("admin", "/api/admin/school", ok, "")
	add("admin", "/api/admin/school/1", ok, "")
	for _, r := range []string{"manager", "librarian", "student"} {
		add(r, "/api/admin/school", denied, r+" must not reach admin data")
	}

	// --- no token at all on a protected route ---
	add("", "/api/books", []int{401}, "unauthenticated must be refused")
	add("", "/api/admin/school", []int{401}, "unauthenticated must be refused")

	return cs
}

// writeChecks only asserts that writes are *refused* for the wrong role. It
// does not create anything, so it is safe to run against a real database.
func writeChecks() []check {
	denied := []int{401, 403}
	return []check{
		{role: "student", method: "POST", path: "/api/books", want: denied, note: "student cannot add books"},
		{role: "student", method: "POST", path: "/api/loan", want: denied, note: "student cannot issue loans"},
		{role: "student", method: "PUT", path: "/api/branch-settings", want: denied, note: "student cannot set policy"},
		{role: "librarian", method: "POST", path: "/api/admin/school", want: denied, note: "librarian cannot create schools"},
		{role: "librarian", method: "POST", path: "/api/manager/branch", want: denied, note: "librarian cannot create branches"},
		{role: "manager", method: "POST", path: "/api/admin/school", want: denied, note: "manager cannot create schools"},
		{role: "student", method: "POST", path: "/api/challenges", want: denied, note: "students cannot author challenges"},
		{role: "student", method: "POST", path: "/api/challenges/1/questions", want: denied, note: "students cannot write quiz questions"},
		{role: "student", method: "DELETE", path: "/api/challenges/1", want: denied, note: "students cannot delete challenges"},
	}
}

/* ------------------------------------------------------------------ http */

func login(c creds) (string, error) {
	body, _ := json.Marshal(map[string]string{"email": c.email, "password": c.password})
	req, _ := http.NewRequest("POST", base+"/api/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	res, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return "", fmt.Errorf("status %d", res.StatusCode)
	}
	var out struct {
		Token string `json:"token"`
	}
	json.NewDecoder(res.Body).Decode(&out)
	if out.Token == "" {
		return "", fmt.Errorf("no token in response")
	}
	return out.Token, nil
}

func call(method, path, token string, body []byte) (int, []byte) {
	var rdr io.Reader
	if body != nil {
		rdr = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, base+path, rdr)
	if err != nil {
		return 0, []byte(err.Error())
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
	if err != nil {
		return 0, []byte(err.Error())
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 400))
	return res.StatusCode, b
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
