// Token storage — sessionStorage, per DECISIONS.md ("Token storage location
// on the frontend"): persists across reloads within a tab, clears on tab
// close. Known trade-off: readable by any script on the page, not XSS-proof.

const ACCESS_TOKEN_KEY = 'bbl.accessToken';
const ID_TOKEN_KEY = 'bbl.idToken';

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getIdToken(): string | null {
  return sessionStorage.getItem(ID_TOKEN_KEY);
}

export function setIdToken(token: string): void {
  sessionStorage.setItem(ID_TOKEN_KEY, token);
}

export function clearTokens(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ID_TOKEN_KEY);
}
