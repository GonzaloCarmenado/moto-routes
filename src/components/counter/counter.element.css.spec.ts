import { describe, it, expect } from 'vitest';
import styles from './counter.element.css?inline';

describe('counter.element.css (AC-006)', () => {
  it('imports tokens.css like the rest of *.element.css', () => {
    // Vite resuelve `@import` en línea al exportar con `?inline` — se
    // comprueba la presencia del contenido resuelto (definición real de un
    // token), no el texto literal "@import"/"tokens.css".
    expect(styles).toContain('--amber:');
  });
});
