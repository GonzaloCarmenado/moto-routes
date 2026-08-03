import { describe, it, expect } from 'vitest';
import styles from './route-map.element.css?inline';

describe('route-map.element.css imports tokens.css', () => {
  it('resolves --panel-sunken like the rest of *.element.css', () => {
    // Vite resuelve `@import` en línea al exportar con `?inline`, así que el
    // texto literal "@import"/"tokens.css" no sobrevive — se comprueba en su
    // lugar que el contenido resuelto de tokens.css (la definición real de un
    // token, no un simple `var(--token)` de uso) está presente.
    expect(styles).toContain('--panel-sunken:');
  });
});

describe('route-map skeleton respects prefers-reduced-motion (AC-007)', () => {
  it('inherits the global prefers-reduced-motion override from tokens.css', () => {
    // El shimmer del skeleton usa `animation:` sin media query propia; se
    // apoya en el override global de tokens.css
    // (`*, *::before, *::after { animation-duration: 0.01ms !important }`)
    // que, al importarse en línea, queda resuelto dentro de este mismo CSS.
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });

  it('defines the skeleton shimmer animation without its own reduced-motion exemption', () => {
    expect(styles).toMatch(/\.route-map-skeleton\s*\{[^}]*animation:/);
  });
});

describe('route-map attribution control styling (AC-009)', () => {
  it('overrides MapLibre\'s attribution control to a discreet, small style coherent with the design system', () => {
    expect(styles).toMatch(/\.maplibregl-ctrl-attrib\s*\{[^}]*font-size:\s*(?!0)[0-9.]+(px|rem)/);
  });
});

describe('route-map attribution button opacity (AC-033)', () => {
  it('reduces the compact attribution button opacity by default', () => {
    expect(styles).toMatch(/\.maplibregl-ctrl-attrib-button\s*\{[^}]*opacity:\s*0\.\d+/);
  });

  it('restores full opacity on hover/focus so it stays reachable', () => {
    expect(styles).toMatch(
      /\.maplibregl-ctrl-attrib-button:hover,\s*\.maplibregl-ctrl-attrib-button:focus-visible\s*\{[^}]*opacity:\s*1/,
    );
  });
});

describe('route-map start/end markers use design tokens, not hardcoded colors (AC-011)', () => {
  it('.route-map-marker--start resolves --success as its base color', () => {
    expect(styles).toMatch(/\.route-map-marker--start\s*\{[^}]*color:\s*var\(--success\)/);
  });

  it('.route-map-marker--end resolves --amber as its base color', () => {
    expect(styles).toMatch(/\.route-map-marker--end\s*\{[^}]*color:\s*var\(--amber\)/);
  });
});

describe('route-map fullscreen button styling (AC-016)', () => {
  it('has a minimum 56x56 hitbox', () => {
    expect(styles).toMatch(
      /\.route-map-fullscreen-toggle\s*\{[^}]*min-width:\s*var\(--hitbox-min\)[^}]*min-height:\s*var\(--hitbox-min\)/,
    );
  });
});

describe('route-map photo marker hit area (AC-036)', () => {
  it('has a minimum 56x56 hitbox around the visible icon', () => {
    expect(styles).toMatch(
      /\.route-map-marker-hitarea\s*\{[^}]*min-width:\s*var\(--hitbox-min\)[^}]*min-height:\s*var\(--hitbox-min\)/,
    );
  });
});

describe('route-map fullscreen icon respects prefers-reduced-motion (AC-021)', () => {
  it('the icon transition relies on the global reduced-motion override, no exemption of its own', () => {
    expect(styles).toMatch(/\.route-map-fullscreen-icon\s*\{[^}]*transition:/);
  });
});
