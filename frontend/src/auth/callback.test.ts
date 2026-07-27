import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth0Config } from './config';
import { AuthCallbackError, handleAuthCallback } from './callback';
import {
  savePkceParams,
  getStoredState,
  getStoredVerifier,
} from './pkceStorage';
import { getAccessToken, getIdToken } from './tokenStorage';

const config: Auth0Config = {
  domain: 'dev-yg.us.auth0.com',
  clientId: 'test-client-id',
  redirectUri: 'http://localhost:3000/callback',
  audience: 'https://bbl-candidate-test-api',
};

function mockFetchOk(body: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('handleAuthCallback — error/edge cases (no network call)', () => {
  it('rejects when Auth0 returned an error param, without calling fetch', async () => {
    const fetchMock = mockFetchOk({});
    vi.stubGlobal('fetch', fetchMock);
    const params = new URLSearchParams({
      error: 'access_denied',
      error_description: 'nope',
    });

    await expect(handleAuthCallback(config, params)).rejects.toThrow(
      AuthCallbackError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when code is missing, without calling fetch', async () => {
    const fetchMock = mockFetchOk({});
    vi.stubGlobal('fetch', fetchMock);
    const params = new URLSearchParams({ state: 'some-state' });

    await expect(handleAuthCallback(config, params)).rejects.toThrow(
      AuthCallbackError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when state is missing, without calling fetch', async () => {
    const fetchMock = mockFetchOk({});
    vi.stubGlobal('fetch', fetchMock);
    const params = new URLSearchParams({ code: 'auth-code' });

    await expect(handleAuthCallback(config, params)).rejects.toThrow(
      AuthCallbackError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects on state mismatch (possible CSRF), without calling fetch', async () => {
    savePkceParams('the-real-state', 'the-verifier');
    const fetchMock = mockFetchOk({});
    vi.stubGlobal('fetch', fetchMock);
    const params = new URLSearchParams({
      code: 'auth-code',
      state: 'a-forged-state',
    });

    await expect(handleAuthCallback(config, params)).rejects.toThrow(
      AuthCallbackError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects when no PKCE params were ever stored (e.g. stale/replayed callback)', async () => {
    const fetchMock = mockFetchOk({});
    vi.stubGlobal('fetch', fetchMock);
    const params = new URLSearchParams({
      code: 'auth-code',
      state: 'any-state',
    });

    await expect(handleAuthCallback(config, params)).rejects.toThrow(
      AuthCallbackError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears the stored PKCE params even when validation fails (one-time use)', async () => {
    savePkceParams('the-real-state', 'the-verifier');
    vi.stubGlobal('fetch', mockFetchOk({}));
    const params = new URLSearchParams({
      code: 'auth-code',
      state: 'a-forged-state',
    });

    await expect(handleAuthCallback(config, params)).rejects.toThrow();
    expect(getStoredState()).toBeNull();
    expect(getStoredVerifier()).toBeNull();
  });
});

describe('handleAuthCallback — success path', () => {
  it('exchanges the code for tokens with the correct request shape, then stores them', async () => {
    savePkceParams('the-real-state', 'the-verifier');
    const fetchMock = mockFetchOk({
      access_token: 'the-access-token',
      id_token: 'the-id-token',
    });
    vi.stubGlobal('fetch', fetchMock);
    const params = new URLSearchParams({
      code: 'auth-code',
      state: 'the-real-state',
    });

    await handleAuthCallback(config, params);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dev-yg.us.auth0.com/oauth/token');
    expect(options.method).toBe('POST');

    const body = new URLSearchParams(options.body);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('client_id')).toBe('test-client-id');
    expect(body.get('code')).toBe('auth-code');
    expect(body.get('redirect_uri')).toBe('http://localhost:3000/callback');
    expect(body.get('code_verifier')).toBe('the-verifier');
    expect(body.get('client_secret')).toBeNull();

    expect(getAccessToken()).toBe('the-access-token');
    expect(getIdToken()).toBe('the-id-token');
  });

  it('clears the one-time PKCE params after a successful exchange', async () => {
    savePkceParams('the-real-state', 'the-verifier');
    vi.stubGlobal(
      'fetch',
      mockFetchOk({
        access_token: 'the-access-token',
        id_token: 'the-id-token',
      }),
    );
    const params = new URLSearchParams({
      code: 'auth-code',
      state: 'the-real-state',
    });

    await handleAuthCallback(config, params);

    expect(getStoredState()).toBeNull();
    expect(getStoredVerifier()).toBeNull();
  });

  it('rejects and does not store tokens when the token endpoint responds non-ok', async () => {
    savePkceParams('the-real-state', 'the-verifier');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    );
    const params = new URLSearchParams({
      code: 'auth-code',
      state: 'the-real-state',
    });

    await expect(handleAuthCallback(config, params)).rejects.toThrow(
      AuthCallbackError,
    );
    expect(getAccessToken()).toBeNull();
    expect(getIdToken()).toBeNull();
  });
});
