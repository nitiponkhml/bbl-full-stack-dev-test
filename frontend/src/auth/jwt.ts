// Client-side JWT payload decoding — for UI decisions only (e.g. "does a
// non-expired token already exist, so skip the login redirect"). This is
// NOT verification: signature/iss/aud are never checked here, since that's
// the backend's job via JWKS (see backend's JwtAuthGuard). A forged or
// tampered token decoded here can only ever affect what the UI *shows*,
// never what data is served — the backend re-validates independently.

function base64UrlDecode(segment: string): string | null {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    return atob(padded);
  } catch {
    return null;
  }
}

export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const decoded = base64UrlDecode(parts[1]);
  if (decoded === null) {
    return null;
  }

  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** Fails safe: any decode failure or missing `exp` is treated as expired. */
export function isTokenExpired(token: string | null): boolean {
  if (!token) {
    return true;
  }

  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== 'number') {
    return true;
  }

  return exp <= Date.now() / 1000;
}
