import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Auth0Config } from './config';
import { buildLogoutUrl, logout } from './logout';
import {
  getAccessToken,
  getIdToken,
  setAccessToken,
  setIdToken,
} from './tokenStorage';

const config: Auth0Config = {
  domain: 'dev-yg.us.auth0.com',
  clientId: 'test-client-id',
  redirectUri: 'http://localhost:3000/callback',
  audience: 'https://bbl-candidate-test-api',
};

function stubLocationAssign() {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  return assign;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('buildLogoutUrl', () => {
  it('targets the tenant /v2/logout endpoint over https', () => {
    const url = new URL(buildLogoutUrl(config));
    expect(url.origin).toBe('https://dev-yg.us.auth0.com');
    expect(url.pathname).toBe('/v2/logout');
  });

  it('sets client_id', () => {
    const url = new URL(buildLogoutUrl(config));
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
  });

  it('sets returnTo to the origin of the redirect URI (per DECISIONS.md logout URL)', () => {
    const url = new URL(buildLogoutUrl(config));
    expect(url.searchParams.get('returnTo')).toBe('http://localhost:3000');
  });
});

describe('logout', () => {
  it('clears both stored tokens', () => {
    setAccessToken('access-token-value');
    setIdToken('id-token-value');
    stubLocationAssign();

    logout(config);

    expect(getAccessToken()).toBeNull();
    expect(getIdToken()).toBeNull();
  });

  it('redirects to the Auth0 logout URL', () => {
    const assignSpy = stubLocationAssign();

    logout(config);

    expect(assignSpy).toHaveBeenCalledWith(buildLogoutUrl(config));
  });
});
