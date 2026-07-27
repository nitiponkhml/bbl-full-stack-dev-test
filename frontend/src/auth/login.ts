import type { Auth0Config } from './config';
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
} from './pkce';
import { savePkceParams } from './pkceStorage';

/**
 * Builds the Auth0 /authorize URL for the Authorization Code + PKCE (S256)
 * flow — no implicit flow, per CLAUDE.md/API_DESIGN.md. Stores the
 * code_verifier and state in sessionStorage so /callback can complete the
 * exchange and validate the response wasn't forged (CSRF).
 */
export async function buildAuthorizeUrl(config: Auth0Config): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();
  savePkceParams(state, verifier);

  const url = new URL(`https://${config.domain}/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('audience', config.audience);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  return url.toString();
}

/** Starts login by redirecting the browser to Auth0's hosted Universal Login. */
export async function redirectToLogin(config: Auth0Config): Promise<void> {
  const url = await buildAuthorizeUrl(config);
  window.location.assign(url);
}
