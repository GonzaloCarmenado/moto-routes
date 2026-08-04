package migrate

import (
	"embed"
	"io/fs"
)

//go:embed migrations
var migrationsFS embed.FS

// Migrations es el sistema de ficheros embebido con los .sql versionados,
// rooteado directamente en el directorio de migraciones.
var Migrations fs.FS

func init() {
	sub, err := fs.Sub(migrationsFS, "migrations")
	if err != nil {
		panic(err)
	}
	Migrations = sub
}
