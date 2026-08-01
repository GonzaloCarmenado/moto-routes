#!/usr/bin/env node
/**
 * Prepara la documentación generada para VitePress copiando fuentes de verdad
 * existentes (sin duplicarlas manualmente en el repo):
 *   - memory/decisions.md   → docs/reference/adr.md
 *   - specs/ui/design-system.md → docs/reference/design-system.md
 *
 * docs/reference/ está en .gitignore — son artefactos de build, no fuente.
 * Solo VitePress los consume.
 *
 * Transformación aplicada: VitePress compila los .md como SFC de Vue — los
 * genéricos TypeScript del tipo `invoke<T>()` en los ADRs se interpretan como
 * tags HTML y rompen el parser. Se escapan los `<...>` precedidos de una letra
 * (patrón de genérico) a entidades HTML.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Caracteres de comparación: GENERIC_OPEN = "<", GENERIC_CLOSE = ">"
const GENERIC_OPEN = String.fromCharCode(60);
const GENERIC_CLOSE = String.fromCharCode(62);
// Entidades HTML construidas sin literales: "<" / ">"
const AMPERSAND = String.fromCharCode(38);
const ENTITY_OPEN = AMPERSAND + 'lt;';
const ENTITY_CLOSE = AMPERSAND + 'gt;';

/**
 * Escapa genéricos TS (`invoke<T>()`) → `invoke<T>()`.
 * Solo afecta a `<` precedido de una letra y seguido de identificador + `>`;
 * no toca HTML real (`<h1>`) ni comparaciones (`a < b`).
 */
function escapeTypeGenerics(markdown) {
  return markdown.replace(
    new RegExp(`(\\w)${GENERIC_OPEN}(\\w[\\w.]*)${GENERIC_CLOSE}`, 'g'),
    `$1${ENTITY_OPEN}$2${ENTITY_CLOSE}`,
  );
}

const sources = [
  {
    from: resolve(root, 'memory/decisions.md'),
    to: resolve(root, 'docs/reference/adr.md'),
  },
  {
    from: resolve(root, 'specs/ui/design-system.md'),
    to: resolve(root, 'docs/reference/design-system.md'),
  },
];

for (const { from, to } of sources) {
  if (!existsSync(from)) {
    console.warn(`⚠️  No existe ${from} — se omite.`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  const content = readFileSync(from, 'utf8');
  writeFileSync(to, escapeTypeGenerics(content));
  console.log(`✓ Copiado (con escape de genéricos) ${from} → ${to}`);
}