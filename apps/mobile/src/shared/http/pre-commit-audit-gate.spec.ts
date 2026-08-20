import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// El comportamiento de bloqueo real (código de salida ≠ 0) ya se verificó
// manualmente ejecutando `bash scripts/pre-commit.sh` con un fallo simulado
// (ver tasks.md de openspec/changes/auditoria-seguridad/, tarea 5.2). Este
// test deja esa verificación como regresión automática: si alguien edita el
// hook o el script y pierde alguna de las tres auditorías o el fail-fast
// centralizado, este test falla en vez de que el gate se rompa en silencio.
// .husky/pre-commit ahora solo delega en scripts/pre-commit.sh (que sí lleva
// los comandos reales, con progreso visible por paso) — ambos ficheros viven
// en la raíz del repo (transversales al monorepo, no exclusivos de
// apps/mobile), dos niveles por encima del cwd real de Vitest.
const repoRoot = resolve(process.cwd(), '../..');
const preCommitHook = readFileSync(resolve(repoRoot, '.husky/pre-commit'), 'utf8');
const preCommitScript = readFileSync(resolve(repoRoot, 'scripts/pre-commit.sh'), 'utf8');

describe('.husky/pre-commit — delega en scripts/pre-commit.sh', () => {
  it('invokes the progress script instead of chaining commands inline', () => {
    expect(preCommitHook).toMatch(/bash scripts\/pre-commit\.sh/);
  });
});

describe('scripts/pre-commit.sh — gate de auditoría de dependencias (frontend, Rust y Go)', () => {
  it('runs pnpm audit at high severity', () => {
    expect(preCommitScript).toMatch(/pnpm audit --audit-level=high/);
  });

  it('runs cargo audit', () => {
    expect(preCommitScript).toMatch(/cargo audit --ignore RUSTSEC-2023-0071 --ignore RUSTSEC-2026-0235/);
  });

  it('runs govulncheck for apps/api', () => {
    expect(preCommitScript).toMatch(/cd apps\/api && govulncheck \.\/\.\.\./);
  });

  it('fails fast (exit 1) as soon as any step fails, before running the rest', () => {
    expect(preCommitScript).toMatch(/if ! "step_\$i"; then/);
    expect(preCommitScript).toMatch(/exit 1/);
  });

  it('runs all three audits before ESLint (fail fast, before spending time on tests/build)', () => {
    const pnpmAuditIndex = preCommitScript.indexOf('pnpm audit --audit-level=high');
    const cargoAuditIndex = preCommitScript.indexOf('cargo audit');
    const govulncheckIndex = preCommitScript.indexOf('govulncheck');
    const eslintIndex = preCommitScript.indexOf('eslint');

    expect(pnpmAuditIndex).toBeGreaterThan(-1);
    expect(cargoAuditIndex).toBeGreaterThan(-1);
    expect(govulncheckIndex).toBeGreaterThan(-1);
    expect(eslintIndex).toBeGreaterThan(-1);
    expect(pnpmAuditIndex).toBeLessThan(eslintIndex);
    expect(cargoAuditIndex).toBeLessThan(eslintIndex);
    expect(govulncheckIndex).toBeLessThan(eslintIndex);
  });
});

describe('scripts/pre-commit.sh — comandos de apps/mobile resuelven la ruta correcta tras el monorepo', () => {
  it('runs cargo commands inside apps/mobile/src-tauri', () => {
    expect(preCommitScript).toMatch(/cd apps\/mobile\/src-tauri && cargo audit --ignore RUSTSEC-2023-0071/);
    expect(preCommitScript).toMatch(/cd apps\/mobile\/src-tauri && cargo fmt --check/);
    expect(preCommitScript).toMatch(/cd apps\/mobile\/src-tauri && cargo clippy -- -D warnings/);
    expect(preCommitScript).toMatch(/cd apps\/mobile\/src-tauri && cargo test/);
  });

  it('runs ESLint and Vitest inside apps/mobile', () => {
    expect(preCommitScript).toMatch(/cd apps\/mobile && npx eslint src\/ --max-warnings 0/);
    expect(preCommitScript).toMatch(/cd apps\/mobile && npx vitest run --coverage --silent/);
  });

  it('runs the Cypress E2E suite inside apps/mobile', () => {
    expect(preCommitScript).toMatch(/cd apps\/mobile && pnpm test:e2e/);
  });
});
