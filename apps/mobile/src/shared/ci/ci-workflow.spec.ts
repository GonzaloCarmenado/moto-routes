import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mismo patrón que pre-commit-audit-gate.spec.ts (src/shared/http/): aserciones
// de texto plano sobre el fichero real, sin parser de YAML (no es dependencia
// del proyecto y no se instala sin confirmarlo antes). No valida sintaxis YAML
// per se — GitHub Actions ya rechaza un workflow mal formado al ejecutarlo — solo
// que la estructura y los comandos esperados están presentes y en el job correcto.
// El workflow vive en la raíz del repo (transversal), dos niveles por encima
// de apps/mobile (cwd real cuando Vitest se ejecuta desde aquí).
const workflowPath = resolve(process.cwd(), '../../.github/workflows/ci.yml');

function readWorkflow(): string {
  if (!existsSync(workflowPath)) return '';
  return readFileSync(workflowPath, 'utf8');
}

/** Extrae el bloque de texto de un job concreto, hasta el siguiente job de nivel 2 (2 espacios) o el fin del fichero. */
function extractJob(workflow: string, jobName: string): string {
  const jobHeaderRe = new RegExp(`^  ${jobName}:\\s*$`, 'm');
  const match = jobHeaderRe.exec(workflow);
  if (!match) return '';
  const start = match.index + match[0].length;
  const rest = workflow.slice(start);
  const nextJobMatch = /^\n {2}\S.*:\s*$/m.exec(rest);
  return nextJobMatch ? rest.slice(0, nextJobMatch.index) : rest;
}

describe('.github/workflows/ci.yml — existe y dispara en los eventos correctos', () => {
  it('the workflow file exists', () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  it('triggers on push and pull_request', () => {
    const workflow = readWorkflow();
    expect(workflow).toMatch(/on:[\s\S]*push:/);
    expect(workflow).toMatch(/on:[\s\S]*pull_request:/);
  });

  it('the push trigger includes version tags (v*)', () => {
    const workflow = readWorkflow();
    expect(workflow).toMatch(/tags:.*v\*/);
  });

  it('declares the three expected jobs', () => {
    const workflow = readWorkflow();
    expect(workflow).toMatch(/^ {2}quality-ts:\s*$/m);
    expect(workflow).toMatch(/^ {2}quality-tauri:\s*$/m);
    expect(workflow).toMatch(/^ {2}build-and-release:\s*$/m);
  });
});

describe('job quality-ts', () => {
  const job = (): string => extractJob(readWorkflow(), 'quality-ts');

  it('caches pnpm via actions/setup-node', () => {
    expect(job()).toMatch(/actions\/setup-node@v\d/);
    expect(job()).toMatch(/cache:\s*pnpm/);
  });

  it('installs dependencies at the repo root (single workspace lockfile)', () => {
    expect(job()).toMatch(/pnpm install --frozen-lockfile/);
  });

  it('runs the documentation coverage check at the repo root (root package.json owns docs:*)', () => {
    const match = /name: Documentation coverage[\s\S]*?run: pnpm run docs:coverage/.exec(job());

    expect(match).not.toBeNull();
    expect(match?.[0]).not.toMatch(/working-directory/);
  });

  it('runs tsc --noEmit inside apps/mobile', () => {
    expect(job()).toMatch(/name: Typecheck[\s\S]*?working-directory: apps\/mobile[\s\S]*?run: pnpm exec tsc --noEmit/);
  });

  it('runs ESLint with zero warnings allowed inside apps/mobile', () => {
    expect(job()).toMatch(
      /name: ESLint[\s\S]*?working-directory: apps\/mobile[\s\S]*?run: pnpm exec eslint src\/ --max-warnings 0/,
    );
  });

  it('runs Vitest with coverage inside apps/mobile', () => {
    expect(job()).toMatch(
      /name: Unit tests[\s\S]*?working-directory: apps\/mobile[\s\S]*?run: pnpm exec vitest run --coverage/,
    );
  });

  it('runs the Cypress E2E suite inside apps/mobile', () => {
    expect(job()).toMatch(/name: E2E tests[\s\S]*?working-directory: apps\/mobile[\s\S]*?run: pnpm run test:e2e/);
  });
});

describe('job quality-tauri', () => {
  const job = (): string => extractJob(readWorkflow(), 'quality-tauri');

  it('caches Cargo via a rust-cache action scoped to apps/mobile/src-tauri', () => {
    expect(job()).toMatch(/rust-cache@v\d[\s\S]*?workspaces:\s*apps\/mobile\/src-tauri/);
  });

  it('runs cargo fmt --check inside apps/mobile/src-tauri', () => {
    expect(job()).toMatch(/working-directory:\s*apps\/mobile\/src-tauri[\s\S]*?run: cargo fmt --check/);
  });

  it('runs cargo clippy denying warnings', () => {
    expect(job()).toMatch(/cargo clippy .*-D warnings/);
  });

  it('runs cargo test', () => {
    expect(job()).toMatch(/cargo test/);
  });

  it('runs cargo audit with the documented RUSTSEC exception', () => {
    expect(job()).toMatch(/cargo audit --ignore RUSTSEC-2023-0071/);
  });
});

describe('job build-and-release', () => {
  const job = (): string => extractJob(readWorkflow(), 'build-and-release');

  it('depends on both quality gates passing first', () => {
    expect(job()).toMatch(/needs:\s*\[?\s*quality-ts,\s*quality-tauri/);
  });

  it('only runs on version tags, never on a normal push to master', () => {
    expect(job()).toMatch(/if:.*refs\/tags\/v/);
  });

  it('runs on ubuntu-latest', () => {
    expect(job()).toMatch(/runs-on:\s*ubuntu-latest/);
  });

  it('overrides the Android NDK linker via an environment variable, not the local .cargo/config.toml path', () => {
    expect(job()).toMatch(/CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER/);
    expect(job()).not.toMatch(/D:\\\\Android\\\\Sdk/);
  });

  it('caches the Android SDK/NDK install', () => {
    expect(job()).toMatch(/actions\/cache@v\d/);
  });

  it('builds via the Tauri CLI inside apps/mobile, never a manual cargo build', () => {
    expect(job()).toMatch(
      /name: Build APK[\s\S]*?working-directory: apps\/mobile[\s\S]*?run: pnpm tauri android build --target aarch64 --debug/,
    );
    expect(job()).not.toMatch(/cargo build --target aarch64-linux-android/);
  });

  it('verifies the freshly built APK against apps/mobile paths', () => {
    expect(job()).toMatch(/apps\/mobile\/src-tauri\/gen\/android\/app\/build\/outputs\/apk/);
    expect(job()).toMatch(/apps\/mobile\/dist\/index\.html/);
  });

  it('publishes the APK as a GitHub Release asset', () => {
    expect(job()).toMatch(/action-gh-release@v\d/);
  });
});
