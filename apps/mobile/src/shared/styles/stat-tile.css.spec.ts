import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `?inline` resuelve `@import` en línea bajo Vite/Vitest (`css: true`), así
// que no sirve para comprobar el contenido *literal* de este fichero frente
// al bloque original de `cockpit.element.css` — se lee el fichero fuente
// directamente, mismo patrón que `nav-bar.element.spec.ts`.
const cssPath = resolve(process.cwd(), 'src/shared/styles/stat-tile.css');
const styles = readFileSync(cssPath, 'utf8');

describe('shared/styles/stat-tile.css (AC-028, AC-034)', () => {
  it('imports tokens.css like the rest of shared styles', () => {
    expect(styles).toContain("@import './tokens.css';");
  });

  it('defines .stat-grid with the exact layout previously in cockpit.element.css', () => {
    expect(styles).toMatch(
      /\.stat-grid\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);[^}]*gap:\s*10px;[^}]*margin-bottom:\s*var\(--space-5\);[^}]*}/,
    );
  });

  it('defines .stat-tile with the exact visual rules previously in cockpit.element.css', () => {
    expect(styles).toMatch(
      /\.stat-tile\s*{[^}]*min-width:\s*0;[^}]*background:\s*var\(--panel\);[^}]*border-top:\s*2px solid var\(--rust-line\);[^}]*border-radius:\s*4px 4px var\(--r-md\) var\(--r-md\);[^}]*padding:\s*var\(--space-3\) var\(--space-4\);[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*2px;[^}]*}/,
    );
  });

  it('defines .stat-tile .stat-label/.stat-value/.stat-unit with the exact original typography rules', () => {
    expect(styles).toMatch(
      /\.stat-tile \.stat-label\s*{[^}]*font-size:\s*12px;[^}]*text-transform:\s*uppercase;[^}]*letter-spacing:\s*0\.06em;[^}]*color:\s*var\(--ink-faint\);[^}]*font-weight:\s*600;[^}]*}/,
    );
    expect(styles).toMatch(/\.stat-tile \.stat-value\s*{[^}]*font-size:\s*26px;[^}]*color:\s*var\(--ink\);[^}]*}/);
    expect(styles).toMatch(
      /\.stat-tile \.stat-unit\s*{[^}]*font-size:\s*13px;[^}]*color:\s*var\(--ink-soft\);[^}]*font-weight:\s*500;[^}]*}/,
    );
  });
});
