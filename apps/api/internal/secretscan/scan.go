// Package secretscan detecta secretos hardcodeados en los ficheros
// versionados de apps/api (cadenas de conexión de PostgreSQL con credenciales
// embebidas), como regresión automática del requisito de api-security.
package secretscan

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// dsnWithCredentials detecta un DSN de PostgreSQL con usuario y contraseña
// embebidos en la propia URL (postgres://user:pass@host).
var dsnWithCredentials = regexp.MustCompile(`postgres(?:ql)?://[^:\s"'/]+:[^@\s"']+@`)

// Scan recorre root buscando secretos hardcodeados en ficheros .go, .sql y
// Dockerfile, excluyendo ficheros de test (que usan valores de prueba
// legítimos). Devuelve una entrada "fichero:línea: contenido" por hallazgo.
func Scan(root string) ([]string, error) {
	var findings []string

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if d.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		if !isScannable(path) {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		for i, line := range strings.Split(string(content), "\n") {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "--") {
				continue // comentario de documentación, no código ni datos reales
			}
			if dsnWithCredentials.MatchString(line) {
				findings = append(findings, fmt.Sprintf("%s:%d: %s", path, i+1, trimmed))
			}
		}
		return nil
	})

	return findings, err
}

func isScannable(path string) bool {
	if strings.HasSuffix(path, "_test.go") {
		return false
	}
	ext := filepath.Ext(path)
	if ext == ".go" || ext == ".sql" {
		return true
	}
	return strings.EqualFold(filepath.Base(path), "Dockerfile")
}
