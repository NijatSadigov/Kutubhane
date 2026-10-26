package config

import (
	"log"
	"os"
)

// getEnv returns the value of an environment variable, falling back to a
// development default when it is unset. Falling back is logged loudly so a
// production deployment that forgot to set the variable is easy to spot.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	log.Printf("[config] WARNING: %s is not set — using an insecure development default. Set it before deploying.", key)
	return fallback
}

// JWTSecret signs and verifies auth tokens. MUST be overridden in production
// via the JWT_SECRET environment variable; the default below is public.
var JWTSecret = getEnv("JWT_SECRET", "dev-insecure-secret-change-me")

// DatabaseDSN is the Postgres connection string, overridable via DATABASE_DSN.
var DatabaseDSN = getEnv(
	"DATABASE_DSN",
	"host=localhost user=postgres password=2334 dbname=school_library port=5432 sslmode=disable",
)

// CORSOrigins is the comma-separated list of browser origins allowed to call
// the API, from CORS_ORIGINS. The default is the two local dev servers.
//
// It is deliberately not settable to "*": the API is called with credentials,
// and a wildcard with credentials is both refused by browsers and wrong. A
// deployment that serves the built UI from this same server (see StaticDir)
// needs no entry here at all, because nothing is cross-origin.
//
// Unset in development is the normal case, so this one does not warn.
var CORSOrigins = envOr("CORS_ORIGINS", "http://localhost:5180,http://localhost:5173")

// StaticDir, when set, is a directory of built frontend files that this server
// serves alongside the API — one process, one origin, no CORS. Unset means the
// UI is hosted somewhere else and CORSOrigins has to name it.
var StaticDir = os.Getenv("STATIC_DIR")

// envOr is getEnv without the warning, for settings whose default is a fine
// answer rather than an insecure one.
func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// ProxyHeader returns the header Fiber should read the client's address from,
// or "" to use the connection's own address.
//
// Set TRUST_PROXY=true only when something you control — Caddy, nginx — is in
// front and setting X-Forwarded-For. Behind one, every request otherwise
// appears to come from 127.0.0.1 and the login rate limiter sees the whole
// internet as one client. Without one, the header is whatever the client
// typed, and trusting it hands every attacker an unlimited supply of
// addresses. There is no safe default, so this is a decision rather than a
// guess.
func ProxyHeader() string {
	if os.Getenv("TRUST_PROXY") == "true" {
		return "X-Forwarded-For"
	}
	return ""
}
