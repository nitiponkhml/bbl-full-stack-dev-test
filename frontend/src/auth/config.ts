// Auth0 SPA config, read from Vite env vars. Fails fast (throws at call
// time, before any redirect/token-exchange attempt) if a var is missing —
// mirrors the backend's AUTH0_DOMAIN/AUTH0_AUDIENCE fail-fast check.

export interface Auth0Config {
  domain: string;
  clientId: string;
  redirectUri: string;
  audience: string;
}

export function getAuth0Config(): Auth0Config {
  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_AUTH0_REDIRECT_URI;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const missing = [
    ['VITE_AUTH0_DOMAIN', domain],
    ['VITE_AUTH0_CLIENT_ID', clientId],
    ['VITE_AUTH0_REDIRECT_URI', redirectUri],
    ['VITE_AUTH0_AUDIENCE', audience],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Missing required Auth0 env var(s): ${missing.join(', ')}`);
  }

  return { domain, clientId, redirectUri, audience };
}
