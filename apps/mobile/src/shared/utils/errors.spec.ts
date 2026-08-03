import { describe, it, expect } from 'vitest';
import { toErrorMessage } from './errors.js';

describe('toErrorMessage', () => {
  it('returns the message of a real Error instance', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the value itself for plain string rejections (e.g. Tauri invoke())', () => {
    expect(toErrorMessage('sql: no such table: photos')).toBe('sql: no such table: photos');
  });

  it('extracts .message from a plain object rejection', () => {
    expect(toErrorMessage({ message: 'permission denied' })).toBe('permission denied');
  });

  it('falls back to JSON.stringify for objects without a message field', () => {
    expect(toErrorMessage({ code: 403 })).toBe('{"code":403}');
  });

  it('uses the provided fallback when the value cannot be stringified', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(toErrorMessage(circular, 'unreadable error')).toBe('unreadable error');
  });

  it('uses the default fallback when none is provided and the value cannot be read', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(toErrorMessage(circular)).toBe('Error desconocido');
  });
});
