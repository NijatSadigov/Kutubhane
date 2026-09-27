package database

import (
	"log"
	"os"

	"school-library-system/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// gormLogLevel reads GORM_LOG: "info" for every statement, "silent" for none,
// and warnings only by default.
func gormLogLevel() logger.LogLevel {
	switch os.Getenv("GORM_LOG") {
	case "info":
		return logger.Info
	case "silent":
		return logger.Silent
	default:
		return logger.Warn
	}
}

func Connect() {

	dsn := config.DatabaseDSN

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		// Info logs every statement, which is useful while developing and very
		// slow under load. GORM_LOG=info brings it back.
		Logger: logger.Default.LogMode(gormLogLevel()),
	})

	if err != nil {
		log.Fatal("Failed to connect to database. \n", err)
	}

	log.Println("Connected to Database!")
	DB = db
}
