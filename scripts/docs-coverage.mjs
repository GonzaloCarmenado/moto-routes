#!/usr/bin/env node
/**
 * Valida que la cobertura de documentación (typedoc-plugin-coverage) no baje
 * del umbral configurado. Lee `docs/api/coverage.json` generado por `typedoc`.
 *
 * Uso: node scripts/docs-coverage.mjs [threshold]
 *   threshold: porcentaje mínimo (entero 0-100). Por defecto: 50.
 *
 * Exit code: 0 si cumple el umbral, 1 si baja (para fallar en pre-commit/CI).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const threshold = Number(process.argv[2] ?? process.env.DOCS_COVERAGE_THRESHOLD ?? 50);

if (Number.isNaN(threshold) || threshold < 0 || threshold > 100) {
  console.error(`Umbral inválido: ${process.argv[2]} (debe ser 0-100)`);
  process.exit(1);
}

const coveragePath = resolve('docs/api/coverage.json');

let coverage;
try {
  coverage = JSON.parse(readFileSync(coveragePath, 'utf8'));
} catch (error) {
  console.error(`No se pudo leer ${coveragePath} — ejecuta antes 'pnpm docs:coverage'`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const percent = coverage.percent;
const expected = coverage.expected;
const actual = coverage.actual;

console.log(`Cobertura de documentación: ${percent}% (${actual}/${expected} símbolos documentados). Umbral: ${threshold}%`);

if (expected === 0) {
  console.error('⚠️ 0 símbolos esperados — revisa entryPoints/entryPointStrategy de typedoc.json');
  process.exit(1);
}

if (percent < threshold) {
  console.error(`❌ Cobertura ${percent}% < umbral ${threshold}%. Documenta los exports públicos o baja el umbral en typedoc.json / scripts/docs-coverage.mjs.`);
  process.exit(1);
}

console.log('✅ Cobertura de documentación por encima del umbral.');