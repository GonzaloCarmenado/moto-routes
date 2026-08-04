import { describe, it, expect, vi, afterEach } from 'vitest';
import { getApiBaseUrl } from './api-config.js';

describe('getApiBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to the local dev host when VITE_API_BASE_URL is not set', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    expect(getApiBaseUrl()).toBe('http://localhost:8080');
  });

  it('uses VITE_API_BASE_URL when set', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://example.internal:9090');

    expect(getApiBaseUrl()).toBe('http://example.internal:9090');
  });
});
