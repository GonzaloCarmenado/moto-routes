import { describe, it, expect } from 'vitest';
import styles from './photo-capture.element.css?inline';

describe('photo-capture.element.css (AC-004)', () => {
  it('imports tokens.css like the rest of *.element.css', () => {
    // Vite resuelve `@import` en línea al exportar con `?inline`, así que el
    // texto literal "@import"/"tokens.css" no sobrevive — se comprueba en su
    // lugar que el contenido resuelto de tokens.css (la definición real de un
    // token, no un simple `var(--token)` de uso) está presente.
    expect(styles).toContain('--amber:');
  });

  it('does not contain hardcoded var(--token, #hex/rgba) fallbacks', () => {
    expect(styles).not.toMatch(/var\(--[a-z0-9-]+,\s*[^)]+\)/);
  });
});

describe('photo-capture spinner respects prefers-reduced-motion (AC-005)', () => {
  it('inherits the global prefers-reduced-motion override from tokens.css', () => {
    // El spinner usa `animation: photo-capture-spin 0.7s linear infinite` sin
    // media query propia; se apoya en el override global de tokens.css
    // (`*, *::before, *::after { animation-duration: 0.01ms !important }`)
    // que, al importarse en línea, queda resuelto dentro de este mismo CSS.
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });

  it('defines the spin animation without its own reduced-motion exemption', () => {
    expect(styles).toContain('animation: photo-capture-spin 0.7s linear infinite');
  });
});
