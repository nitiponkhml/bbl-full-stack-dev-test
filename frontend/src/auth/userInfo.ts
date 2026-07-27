import { decodeJwtPayload } from './jwt';
import { getIdToken } from './tokenStorage';

export interface UserInfo {
  name: string | null;
  email: string | null;
  picture: string | null;
}

function stringClaim(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

/**
 * Decodes the ID Token (display only — never sent to the backend, per
 * CLAUDE.md) to read standard OIDC profile claims for the UI.
 */
export function getUserInfo(): UserInfo | null {
  const idToken = getIdToken();
  if (!idToken) {
    return null;
  }

  const payload = decodeJwtPayload(idToken);
  if (!payload) {
    return null;
  }

  return {
    name: stringClaim(payload, 'name'),
    email: stringClaim(payload, 'email'),
    picture: stringClaim(payload, 'picture'),
  };
}
