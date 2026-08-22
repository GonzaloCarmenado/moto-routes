import { describe, it, expect } from 'vitest';
import { toErrorMessage } from './errors.js';
import { ExternalApiError } from '../http/external-api.service.js';

describe('toErrorMessage', () => {
  it('returns the message of a real Error instance', () => {
    expect(toErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('prefers the caller-provided fallback over the raw technical message of an ExternalApiError (bug real: un timeout de red mostraba literalmente "Request to https://... timed out")', () => {
    const err = new ExternalApiError('timeout', 'Request to https://api.example.com/routes timed out');
    expect(toErrorMessage(err, 'No se pudo actualizar la ruta en la nube')).toBe('No se pudo actualizar la ruta en la nube');
  });

  it('falls back to the default message for an ExternalApiError when no fallback was given', () => {
    const err = new ExternalApiError('network', 'Network error requesting https://api.example.com/routes: TypeError');
    expect(toErrorMessage(err)).toBe('Error desconocido');
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
