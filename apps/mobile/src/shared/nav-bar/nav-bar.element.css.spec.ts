import { describe, it, expect } from 'vitest';
import styles from './nav-bar.element.css?inline';

describe('nav-bar.element.css (AC-007)', () => {
  it('does not contain any hardcoded oklch(...) literal', () => {
    expect(styles).not.toMatch(/box-shadow:[^;]*oklch\(/);
    expect(styles).not.toMatch(/text-shadow:[^;]*oklch\(/);
  });

  it('uses the --amber-glow token for the amber glow effect', () => {
    expect(styles).toContain('var(--amber-glow)');
  });
});
