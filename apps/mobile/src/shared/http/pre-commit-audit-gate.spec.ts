import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// El comportamiento de bloqueo real (código de salida ≠ 0) ya se verificó
// manualmente ejecutando `sh .husky/pre-commit` con un fallo simulado (ver
// tasks.md de openspec/changes/auditoria-seguridad/, tarea 5.2). Este test
// deja esa verificación como regresión automática: si alguien edita el hook
// y pierde el `|| exit 1` de cualquiera de las dos auditorías, este test
// falla en vez de que el gate se rompa en silencio.
// .husky/ vive en la raíz del repo (hooks Git son transversales al monorepo,
// no exclusivos de apps/mobile), dos niveles por encima del cwd real de Vitest.
const preCommitPath = resolve(process.cwd(), '../../.husky/pre-commit');
const preCommit = readFileSync(preCommitPath, 'utf8');

describe('.husky/pre-commit — gate de auditoría de dependencias (frontend y Rust)', () => {
  it('runs pnpm audit at high severity and exits on failure', () => {
    expect(preCommit).toMatch(/pnpm audit --audit-level=high\s*\|\|\s*exit 1/);
  });

  it('runs cargo audit and exits on failure', () => {
    expect(preCommit).toMatch(/cargo audit[^|]*\|\|\s*exit 1/);
  });

  it('runs both audits before ESLint (fail fast, before spending time on tests/build)', () => {
    const pnpmAuditIndex = preCommit.indexOf('pnpm audit --audit-level=high');
    const cargoAuditIndex = preCommit.indexOf('cargo audit');
    const eslintIndex = preCommit.indexOf('eslint');

    expect(pnpmAuditIndex).toBeGreaterThan(-1);
    expect(cargoAuditIndex).toBeGreaterThan(-1);
    expect(eslintIndex).toBeGreaterThan(-1);
    expect(pnpmAuditIndex).toBeLessThan(eslintIndex);
    expect(cargoAuditIndex).toBeLessThan(eslintIndex);
  });
});

describe('.husky/pre-commit — comandos de apps/mobile resuelven la ruta correcta tras el monorepo', () => {
  it('runs cargo commands inside apps/mobile/src-tauri', () => {
    expect(preCommit).toMatch(/cd apps\/mobile\/src-tauri && cargo audit --ignore RUSTSEC-2023-0071/);
    expect(preCommit).toMatch(/cd apps\/mobile\/src-tauri && cargo fmt --check/);
    expect(preCommit).toMatch(/cd apps\/mobile\/src-tauri && cargo clippy -- -D warnings/);
    expect(preCommit).toMatch(/cd apps\/mobile\/src-tauri && cargo test/);
  });

  it('runs ESLint and Vitest inside apps/mobile', () => {
    expect(preCommit).toMatch(/cd apps\/mobile && npx eslint src\/ --max-warnings 0/);
    expect(preCommit).toMatch(/cd apps\/mobile && npx vitest run --coverage --silent/);
  });

  it('runs the Cypress E2E suite inside apps/mobile', () => {
    expect(preCommit).toMatch(/cd apps\/mobile && pnpm test:e2e/);
  });
});
