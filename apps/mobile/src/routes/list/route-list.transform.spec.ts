import { describe, it, expect } from 'vitest';
import { buildPolylineSvgPath } from './route-list.transform.js';

describe('buildPolylineSvgPath (AC-021, AC-022, AC-024)', () => {
  it('returns a non-empty "d" path string with a previewPolyline of 2+ points', () => {
    const d = buildPolylineSvgPath(
      [
        [10, 20],
        [11, 21],
        [12, 22],
      ],
      72,
      72,
    );
    expect(d).not.toBeNull();
    expect(d!.length).toBeGreaterThan(0);
  });

  it('returns null with a null polyline (caller must fall back to the placeholder)', () => {
    expect(buildPolylineSvgPath(null, 72, 72)).toBeNull();
  });

  it('returns null with an empty polyline', () => {
    expect(buildPolylineSvgPath([], 72, 72)).toBeNull();
  });

  it('returns null with a single point (cannot draw a line)', () => {
    expect(buildPolylineSvgPath([[10, 20]], 72, 72)).toBeNull();
  });

  it('maps higher-latitude points to smaller Y coordinates within the viewBox (north up, not upside down)', () => {
    const d = buildPolylineSvgPath(
      [
        [10, 0],
        [20, 0],
      ],
      100,
      100,
    )!;
    const numbers = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    const [, y0, , y1] = numbers;
    // El segundo punto (lat=20, mayor) debe quedar por encima (Y menor) que el
    // primero (lat=10, menor) — norte arriba, igual que un mapa normal.
    expect(y1).toBeLessThan(y0!);
  });
});
