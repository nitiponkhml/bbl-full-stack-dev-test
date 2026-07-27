// RFC 7636 (PKCE) helpers: code_verifier, code_challenge (S256), and the
// OAuth `state` param (CSRF protection for the redirect back from Auth0).

const UNRESERVED_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function randomUnreservedString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = '';
  for (const byte of bytes) {
    result += UNRESERVED_CHARS[byte % UNRESERVED_CHARS.length];
  }
  return result;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** A high-entropy cryptographically random string, 43-128 chars (RFC 7636 §4.1). */
export function generateCodeVerifier(): string {
  return randomUnreservedString(64);
}

/** SHA-256 (S256) transform of the verifier, base64url-encoded (RFC 7636 §4.2). */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/** Opaque random value echoed back by Auth0, checked on callback to prevent CSRF. */
export function generateState(): string {
  return randomUnreservedString(32);
}
