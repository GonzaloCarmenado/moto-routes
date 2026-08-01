import { describe, it, expect } from 'vitest';
import { sanitizeText } from './text.js';

describe('sanitizeText', () => {
  it('should trim leading and trailing whitespace', () => {
    expect(sanitizeText('  Marc  ', 100)).toBe('Marc');
  });

  it('should truncate to exactly maxLength characters', () => {
    const result = sanitizeText('a'.repeat(150), 100);
    expect(result).toHaveLength(100);
    expect(result).toBe('a'.repeat(100));
  });

  it('should return an empty string when the input is only whitespace', () => {
    expect(sanitizeText('   ', 100)).toBe('');
  });
});
