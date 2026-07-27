import type { Auth0Config } from './config';
import {
  clearPkceParams,
  getStoredState,
  getStoredVerifier,
} from './pkceStorage';
import { setAccessToken, setIdToken } from './tokenStorage';

export class AuthCallbackError extends Error {}

/**
 * Completes the Authorization Code + PKCE flow: validates the `state`
 * echoed back by Auth0 against the one stored before the redirect (CSRF
 * protection), then exchanges the code for tokens using the matching
 * code_verifier — no client_secret, since this is a public SPA client.
 *
 * The stored state/verifier are one-time-use and are cleared as soon as
 * they've been read, regardless of whether the exchange succeeds.
 */
export async function handleAuthCallback(
  config: Auth0Config,
  params: URLSearchParams,
): Promise<void> {
  const error = params.get('error');
  if (error) {
    throw new AuthCallbackError(params.get('error_description') ?? error);
  }

  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) {
    throw new AuthCallbackError('Callback URL is missing code or state');
  }

  const storedState = getStoredState();
  const storedVerifier = getStoredVerifier();
  clearPkceParams();

  if (!storedState || state !== storedState) {
    throw new AuthCallbackError(
      'State mismatch on callback — possible CSRF, login aborted',
    );
  }
  if (!storedVerifier) {
    throw new AuthCallbackError(
      'No PKCE verifier found for this login attempt',
    );
  }

  let data: { access_token: string; id_token: string };
  try {
    const response = await fetch(`https://${config.domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        code,
        redirect_uri: config.redirectUri,
        code_verifier: storedVerifier,
      }),
    });

    if (!response.ok) {
      throw new AuthCallbackError('Auth0 token exchange failed');
    }

    data = await response.json();
  } catch (err) {
    if (err instanceof AuthCallbackError) {
      throw err;
    }
    throw new AuthCallbackError('Auth0 token exchange failed');
  }

  setAccessToken(data.access_token);
  setIdToken(data.id_token);
}
