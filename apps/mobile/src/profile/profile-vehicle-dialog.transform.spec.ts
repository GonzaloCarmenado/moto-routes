import { describe, it, expect } from 'vitest';
import { isKnownMake, buildMakeOptionsList } from './profile-vehicle-dialog.transform.js';
import type { VehicleMake } from './vpic.service.js';

function make(id: number, name: string): VehicleMake {
  return { id, name };
}

describe('isKnownMake', () => {
  it('recognizes a curated make regardless of vPIC casing', () => {
    expect(isKnownMake('HONDA')).toBe(true);
    expect(isKnownMake('Honda')).toBe(true);
  });

  it('recognizes a curated make with a hyphen even if vPIC uses a space, or vice versa', () => {
    expect(isKnownMake('HARLEY DAVIDSON')).toBe(true);
    expect(isKnownMake('HARLEY-DAVIDSON')).toBe(true);
  });

  it('returns false for a make outside the curated list', () => {
    expect(isKnownMake('BAY CITY CHOPPERS')).toBe(false);
  });
});

describe('buildMakeOptionsList', () => {
  it('with no query, shows known makes first (alphabetical), then the rest (alphabetical) — never drops anything', () => {
    const makes = [make(4, 'ZERO MOTORCYCLES'), make(2, 'YAMAHA'), make(9721, 'BAY CITY CHOPPERS'), make(1, 'HONDA'), make(9722, 'BLUE GHOST CYCLES')];
    const result = buildMakeOptionsList(makes, '');

    expect(result.map((m) => m.name)).toEqual(['HONDA', 'YAMAHA', 'BAY CITY CHOPPERS', 'BLUE GHOST CYCLES', 'ZERO MOTORCYCLES']);
  });

  it('preserves the id of each make through filtering/sorting', () => {
    const makes = [make(2, 'YAMAHA'), make(1, 'HONDA')];
    const result = buildMakeOptionsList(makes, '');

    expect(result).toEqual([make(1, 'HONDA'), make(2, 'YAMAHA')]);
  });

  it('with a query, filters across known and unknown makes alike, ignoring the curated order', () => {
    const makes = [make(2, 'YAMAHA'), make(1, 'HONDA'), make(3, 'BAY CITY CHOPPERS'), make(4, 'BLUE GHOST CYCLES')];
    const result = buildMakeOptionsList(makes, 'blue');

    expect(result.map((m) => m.name)).toEqual(['BLUE GHOST CYCLES']);
  });

  it('query matching is case-insensitive and matches substrings', () => {
    const makes = [make(1, 'HONDA'), make(2, 'YAMAHA')];
    expect(buildMakeOptionsList(makes, 'ond').map((m) => m.name)).toEqual(['HONDA']);
    expect(buildMakeOptionsList(makes, 'AMA').map((m) => m.name)).toEqual(['YAMAHA']);
  });

  it('returns an empty array when the query matches nothing', () => {
    expect(buildMakeOptionsList([make(1, 'HONDA'), make(2, 'YAMAHA')], 'zzz')).toEqual([]);
  });

  it('trims surrounding whitespace from the query', () => {
    expect(buildMakeOptionsList([make(1, 'HONDA')], '  honda  ').map((m) => m.name)).toEqual(['HONDA']);
  });
});
