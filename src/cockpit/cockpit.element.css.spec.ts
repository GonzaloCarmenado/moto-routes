import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import styles from './cockpit.element.css?inline';

describe('cockpit.element.css (AC-007)', () => {
  it('does not contain any hardcoded oklch(...) literal', () => {
    expect(styles).not.toMatch(/box-shadow:[^;]*oklch\(/);
    expect(styles).not.toMatch(/text-shadow:[^;]*oklch\(/);
  });

  it('uses the --amber-glow token for the amber glow effect', () => {
    expect(styles).toContain('var(--amber-glow)');
  });
});

// `?inline` resuelve `@import` en línea bajo Vite/Vitest (`css: true`), así
// que transcluiría el contenido de `stat-tile.css` y daría un falso negativo
// al comprobar que ya NO está definido aquí — se lee el fichero fuente
// directamente, mismo patrón que `nav-bar.element.spec.ts`.
const rawCockpitCssPath = resolve(process.cwd(), 'src/cockpit/cockpit.element.css');
const rawCockpitCss = readFileSync(rawCockpitCssPath, 'utf8');

describe('cockpit.element.css — stat-tile extraction (AC-028, AC-034)', () => {
  it('no longer defines .stat-grid/.stat-tile rules directly', () => {
    expect(rawCockpitCss).not.toMatch(/\.stat-grid\s*{/);
    expect(rawCockpitCss).not.toMatch(/\.stat-tile\s*{/);
  });

  it('imports the shared stat-tile.css instead', () => {
    expect(rawCockpitCss).toContain("@import '../shared/styles/stat-tile.css';");
  });
});
