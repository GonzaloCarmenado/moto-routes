import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Mismo patrón que pre-commit-audit-gate.spec.ts (src/shared/http/): aserciones
// de texto plano sobre el fichero real, sin parser de YAML (no es dependencia
// del proyecto y no se instala sin confirmarlo antes). No valida sintaxis YAML
// per se — GitHub Actions ya rechaza un workflow mal formado al ejecutarlo — solo
// que la estructura y los comandos esperados están presentes y en el job correcto.
const workflowPath = resolve(process.cwd(), '.github/workflows/ci.yml');

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

  it('runs tsc --noEmit', () => {
    expect(job()).toMatch(/tsc --noEmit/);
  });

  it('runs the documentation coverage check', () => {
    expect(job()).toMatch(/docs:coverage/);
  });

  it('runs ESLint with zero warnings allowed', () => {
    expect(job()).toMatch(/eslint .*--max-warnings 0/);
  });

  it('runs Vitest with coverage', () => {
    expect(job()).toMatch(/vitest run --coverage/);
  });

  it('runs the Cypress E2E suite', () => {
    expect(job()).toMatch(/test:e2e/);
  });
});

describe('job quality-tauri', () => {
  const job = (): string => extractJob(readWorkflow(), 'quality-tauri');

  it('caches Cargo via a rust-cache action', () => {
    expect(job()).toMatch(/rust-cache@v\d/);
  });

  it('runs cargo fmt --check', () => {
    expect(job()).toMatch(/cargo fmt --check/);
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

  it('builds via the Tauri CLI, never a manual cargo build', () => {
    expect(job()).toMatch(/tauri android build --target aarch64 --debug/);
    expect(job()).not.toMatch(/cargo build --target aarch64-linux-android/);
  });

  it('publishes the APK as a GitHub Release asset', () => {
    expect(job()).toMatch(/action-gh-release@v\d/);
  });
});
