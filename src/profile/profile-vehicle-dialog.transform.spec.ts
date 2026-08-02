import { describe, it, expect } from 'vitest';
import { isKnownMake, buildMakeOptionsList } from './profile-vehicle-dialog.transform.js';

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
    const makes = ['ZERO MOTORCYCLES', 'YAMAHA', 'BAY CITY CHOPPERS', 'HONDA', 'BLUE GHOST CYCLES'];
    const result = buildMakeOptionsList(makes, '');

    expect(result).toEqual(['HONDA', 'YAMAHA', 'BAY CITY CHOPPERS', 'BLUE GHOST CYCLES', 'ZERO MOTORCYCLES']);
  });

  it('with a query, filters across known and unknown makes alike, ignoring the curated order', () => {
    const makes = ['YAMAHA', 'HONDA', 'BAY CITY CHOPPERS', 'BLUE GHOST CYCLES'];
    const result = buildMakeOptionsList(makes, 'blue');

    expect(result).toEqual(['BLUE GHOST CYCLES']);
  });

  it('query matching is case-insensitive and matches substrings', () => {
    const makes = ['HONDA', 'YAMAHA'];
    expect(buildMakeOptionsList(makes, 'ond')).toEqual(['HONDA']);
    expect(buildMakeOptionsList(makes, 'AMA')).toEqual(['YAMAHA']);
  });

  it('returns an empty array when the query matches nothing', () => {
    expect(buildMakeOptionsList(['HONDA', 'YAMAHA'], 'zzz')).toEqual([]);
  });

  it('trims surrounding whitespace from the query', () => {
    expect(buildMakeOptionsList(['HONDA'], '  honda  ')).toEqual(['HONDA']);
  });
});
