import { describe, it, expect } from 'vitest';
import { formatPendingBadge } from './friends-list.transform.js';

describe('formatPendingBadge', () => {
  it('devuelve null sin ninguna solicitud pendiente', () => {
    expect(formatPendingBadge(0)).toBeNull();
  });

  it('devuelve el número exacto hasta 9', () => {
    expect(formatPendingBadge(1)).toBe('1');
    expect(formatPendingBadge(9)).toBe('9');
  });

  it('devuelve "9+" por encima de 9', () => {
    expect(formatPendingBadge(10)).toBe('9+');
    expect(formatPendingBadge(42)).toBe('9+');
  });
});
