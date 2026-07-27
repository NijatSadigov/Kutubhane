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
