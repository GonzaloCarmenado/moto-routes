import { describe, it, expect } from 'vitest';
import {
  ROAD_LAYER_IDS,
  ROAD_LABEL_LAYER_IDS,
  buildRoadContrastOverrides,
  buildRoadLabelContrastOverrides,
} from './route-map-contrast.js';

describe('buildRoadContrastOverrides (AC-001, AC-004, AC-022)', () => {
  it('builds one paint override per known road layer id, using the given color', () => {
    const color = 'rgb(184, 171, 152)';

    const overrides = buildRoadContrastOverrides(color);

    expect(overrides).toHaveLength(ROAD_LAYER_IDS.length);
    for (const layerId of ROAD_LAYER_IDS) {
      expect(overrides).toContainEqual({ layerId, property: 'line-color', value: color });
    }
  });

  it('the suggested colors are warm/neutral tones, not cold blues', () => {
    // La función no impone ningún color propio — el color lo decide
    // route-map.element.ts vía resolveToken(). Este test es una guarda: si
    // se le pasa un tono cálido/neutro, ese es el valor que se propaga tal
    // cual a cada override, nunca sustituido por un azul/tono frío interno.
    const warmColor = 'rgb(184, 171, 152)';

    const overrides = buildRoadContrastOverrides(warmColor);

    expect(overrides.every((override) => override.value === warmColor)).toBe(true);
    expect(overrides.some((override) => /blue|azure|#00f|#0000ff/i.test(override.value))).toBe(
      false,
    );
  });
});

describe('buildRoadLabelContrastOverrides (feedback real de usuario 2026-08-01: nombres de calles/ciudades ilegibles)', () => {
  it('builds one paint override per known road label layer id, using the given color', () => {
    const color = 'rgb(166, 156, 150)';

    const overrides = buildRoadLabelContrastOverrides(color);

    expect(overrides).toHaveLength(ROAD_LABEL_LAYER_IDS.length);
    for (const layerId of ROAD_LABEL_LAYER_IDS) {
      expect(overrides).toContainEqual({ layerId, property: 'text-color', value: color });
    }
  });

  it('does not impose any color of its own — propagates the given value as-is for every label layer', () => {
    const warmColor = 'rgb(166, 156, 150)';

    const overrides = buildRoadLabelContrastOverrides(warmColor);

    expect(overrides.every((override) => override.value === warmColor)).toBe(true);
  });
});
