import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiBaseUrl } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getApiBaseUrl', () => {
  it('returns the configured base URL', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001');
    expect(getApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('throws a fail-fast error naming the var when it is missing', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(() => getApiBaseUrl()).toThrow('VITE_API_BASE_URL');
  });
});
