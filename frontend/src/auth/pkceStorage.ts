// Transient PKCE parameters (state, code_verifier) held only between the
// /authorize redirect and the /callback return — separate from tokenStorage
// since these are one-time-use, not session-lived credentials.

const STATE_KEY = 'bbl.pkce.state';
const VERIFIER_KEY = 'bbl.pkce.verifier';

export function savePkceParams(state: string, verifier: string): void {
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
}

export function getStoredState(): string | null {
  return sessionStorage.getItem(STATE_KEY);
}

export function getStoredVerifier(): string | null {
  return sessionStorage.getItem(VERIFIER_KEY);
}

export function clearPkceParams(): void {
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
}
