package secretscan

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestScan_FindsHardcodedPostgresDSN(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "bad.go", `package x

var dsn = "postgres://admin:S3cr3t@prod-db:5432/app"
`)

	findings, err := Scan(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 1 {
		t.Fatalf("expected 1 finding, got %d: %v", len(findings), findings)
	}
}

func TestScan_IgnoresTestFiles(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "bad_test.go", `package x

var dsn = "postgres://admin:S3cr3t@prod-db:5432/app"
`)

	findings, err := Scan(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected no findings in test files, got %v", findings)
	}
}

func TestScan_IgnoresNonSourceFiles(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "notes.md", "postgres://admin:S3cr3t@prod-db:5432/app")

	findings, err := Scan(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("expected no findings outside .go/.sql/Dockerfile, got %v", findings)
	}
}

func TestScan_RealApiTreeHasNoHardcodedSecrets(t *testing.T) {
	findings, err := Scan(apiModuleRoot(t))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(findings) != 0 {
		t.Fatalf("found hardcoded secrets in versioned files: %v", findings)
	}
}

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
		t.Fatalf("failed to write fixture file: %v", err)
	}
}

// apiModuleRoot resuelve la raíz de apps/api a partir de la ruta de este
// propio fichero de test, sin depender del directorio de trabajo actual.
func apiModuleRoot(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine caller for this test file")
	}
	return filepath.Join(filepath.Dir(thisFile), "..", "..")
}
