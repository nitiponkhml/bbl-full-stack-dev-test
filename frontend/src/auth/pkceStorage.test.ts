import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPkceParams,
  getStoredState,
  getStoredVerifier,
  savePkceParams,
} from './pkceStorage';

beforeEach(() => {
  sessionStorage.clear();
});

describe('savePkceParams / getStoredState / getStoredVerifier', () => {
  it('returns null for both when nothing is stored', () => {
    expect(getStoredState()).toBeNull();
    expect(getStoredVerifier()).toBeNull();
  });

  it('round-trips a stored state and verifier', () => {
    savePkceParams('the-state', 'the-verifier');
    expect(getStoredState()).toBe('the-state');
    expect(getStoredVerifier()).toBe('the-verifier');
  });
});

describe('clearPkceParams', () => {
  it('removes both the state and the verifier', () => {
    savePkceParams('the-state', 'the-verifier');
    clearPkceParams();
    expect(getStoredState()).toBeNull();
    expect(getStoredVerifier()).toBeNull();
  });
});
