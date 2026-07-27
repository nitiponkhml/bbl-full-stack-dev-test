import type { Auth0Config } from './config';
import { clearTokens } from './tokenStorage';

/**
 * Builds Auth0's logout URL. `returnTo` is the origin of the configured
 * redirect URI (http://localhost:3000) — the tenant's Logout URL per
 * CLAUDE.md's "Logout" section.
 */
export function buildLogoutUrl(config: Auth0Config): string {
  const returnTo = new URL(config.redirectUri).origin;
  const url = new URL(`https://${config.domain}/v2/logout`);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('returnTo', returnTo);
  return url.toString();
}

/** Clears local tokens, then ends the Auth0 session via its logout endpoint. */
export function logout(config: Auth0Config): void {
  clearTokens();
  window.location.assign(buildLogoutUrl(config));
}
