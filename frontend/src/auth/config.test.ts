import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuth0Config } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubAllEnvVars() {
  vi.stubEnv('VITE_AUTH0_DOMAIN', 'dev-yg.us.auth0.com');
  vi.stubEnv('VITE_AUTH0_CLIENT_ID', 'test-client-id');
  vi.stubEnv('VITE_AUTH0_REDIRECT_URI', 'http://localhost:3000/callback');
  vi.stubEnv('VITE_AUTH0_AUDIENCE', 'https://bbl-candidate-test-api');
}

describe('getAuth0Config', () => {
  it('returns all four values when every env var is set', () => {
    stubAllEnvVars();
    expect(getAuth0Config()).toEqual({
      domain: 'dev-yg.us.auth0.com',
      clientId: 'test-client-id',
      redirectUri: 'http://localhost:3000/callback',
      audience: 'https://bbl-candidate-test-api',
    });
  });

  it.each([
    'VITE_AUTH0_DOMAIN',
    'VITE_AUTH0_CLIENT_ID',
    'VITE_AUTH0_REDIRECT_URI',
    'VITE_AUTH0_AUDIENCE',
  ])('throws a fail-fast error naming %s when it is missing', (missingVar) => {
    stubAllEnvVars();
    vi.stubEnv(missingVar, '');
    expect(() => getAuth0Config()).toThrow(missingVar);
  });
});
