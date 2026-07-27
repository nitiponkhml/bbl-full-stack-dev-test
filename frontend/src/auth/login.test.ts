import { beforeEach, describe, expect, it } from 'vitest';
import { generateCodeChallenge } from './pkce';
import { getStoredState, getStoredVerifier } from './pkceStorage';
import type { Auth0Config } from './config';
import { buildAuthorizeUrl } from './login';

const config: Auth0Config = {
  domain: 'dev-yg.us.auth0.com',
  clientId: 'test-client-id',
  redirectUri: 'http://localhost:3000/callback',
  audience: 'https://bbl-candidate-test-api',
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('buildAuthorizeUrl', () => {
  it('targets the tenant /authorize endpoint over https', async () => {
    const url = new URL(await buildAuthorizeUrl(config));
    expect(url.origin).toBe('https://dev-yg.us.auth0.com');
    expect(url.pathname).toBe('/authorize');
  });

  it('sets the Authorization Code + PKCE (S256) required params — no implicit flow', async () => {
    const url = new URL(await buildAuthorizeUrl(config));
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/callback',
    );
    expect(url.searchParams.get('audience')).toBe(
      'https://bbl-candidate-test-api',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('openid');
  });

  it('stores a verifier whose S256 challenge matches the URL’s code_challenge', async () => {
    const url = new URL(await buildAuthorizeUrl(config));
    const storedVerifier = getStoredVerifier();
    expect(storedVerifier).not.toBeNull();
    const expectedChallenge = await generateCodeChallenge(
      storedVerifier as string,
    );
    expect(url.searchParams.get('code_challenge')).toBe(expectedChallenge);
  });

  it('stores a state that matches the URL’s state param', async () => {
    const url = new URL(await buildAuthorizeUrl(config));
    expect(getStoredState()).toBe(url.searchParams.get('state'));
  });

  it('generates a fresh state and verifier on each call', async () => {
    const urlA = new URL(await buildAuthorizeUrl(config));
    const stateA = urlA.searchParams.get('state');
    const verifierA = getStoredVerifier();

    const urlB = new URL(await buildAuthorizeUrl(config));
    const stateB = urlB.searchParams.get('state');
    const verifierB = getStoredVerifier();

    expect(stateA).not.toBe(stateB);
    expect(verifierA).not.toBe(verifierB);
  });
});
