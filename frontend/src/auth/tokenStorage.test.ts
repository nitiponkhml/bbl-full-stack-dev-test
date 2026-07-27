import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearTokens,
  getAccessToken,
  getIdToken,
  setAccessToken,
  setIdToken,
} from './tokenStorage';

beforeEach(() => {
  sessionStorage.clear();
});

describe('access token', () => {
  it('returns null when nothing is stored', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('round-trips a stored value', () => {
    setAccessToken('access-token-value');
    expect(getAccessToken()).toBe('access-token-value');
  });

  it('is written to sessionStorage, not localStorage (per DECISIONS.md)', () => {
    setAccessToken('access-token-value');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBeGreaterThan(0);
  });
});

describe('id token', () => {
  it('returns null when nothing is stored', () => {
    expect(getIdToken()).toBeNull();
  });

  it('round-trips a stored value', () => {
    setIdToken('id-token-value');
    expect(getIdToken()).toBe('id-token-value');
  });
});

describe('clearTokens', () => {
  it('removes both tokens', () => {
    setAccessToken('access-token-value');
    setIdToken('id-token-value');
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getIdToken()).toBeNull();
  });
});
