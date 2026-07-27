import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router';
import { isTokenExpired } from './jwt';
import { getAccessToken } from './tokenStorage';

/**
 * Route guard for /collections and /bookmarks (per DECISIONS.md's
 * "Frontend routing" decision): redirects unauthenticated access back to
 * /. This is a UI convenience only, not a security boundary — the backend
 * independently re-validates every request via JWKS.
 */
export function RequireAuth({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  const location = useLocation();
  const token = getAccessToken();

  if (!token || isTokenExpired(token)) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
}
