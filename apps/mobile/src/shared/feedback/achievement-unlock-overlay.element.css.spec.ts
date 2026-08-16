import { describe, it, expect } from 'vitest';
import styles from './achievement-unlock-overlay.element.css?inline';

describe('achievement-unlock-overlay.element.css imports tokens.css', () => {
  it('resolves --amber-soft like the rest of *.element.css', () => {
    expect(styles).toContain('--amber-soft:');
  });
});

describe('achievement-unlock-overlay respects prefers-reduced-motion', () => {
  it('inherits the global prefers-reduced-motion override from tokens.css', () => {
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(styles).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });

  it('defines the overlay/card entrance animations without their own reduced-motion exemption', () => {
    expect(styles).toMatch(/\.overlay\s*\{[^}]*animation:/);
    expect(styles).toMatch(/\.card\s*\{[^}]*animation:/);
  });
});
