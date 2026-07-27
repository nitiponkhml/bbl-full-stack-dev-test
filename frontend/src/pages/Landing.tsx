import { Button, Container, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import { Navigate } from 'react-router';
import { getAuth0Config } from '../auth/config';
import { isTokenExpired } from '../auth/jwt';
import { redirectToLogin } from '../auth/login';
import { getAccessToken } from '../auth/tokenStorage';

/**
 * / — landing/decision point (not one of the two required pages per
 * §3.2/DECISIONS.md's "Frontend routing" decision). Redirects straight to
 * /collections if a valid, non-expired token already exists; otherwise
 * shows the only login trigger this app has — Auth0's hosted Universal
 * Login is reached by redirecting to /authorize, never a custom form.
 */
export function Landing(): ReactElement {
  const token = getAccessToken();
  if (token && !isTokenExpired(token)) {
    return <Navigate to="/collections" replace />;
  }

  const handleSignIn = () => {
    void redirectToLogin(getAuth0Config());
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        BBL Bookmark Manager
      </Typography>
      <Button variant="contained" onClick={handleSignIn}>
        Sign in
      </Button>
    </Container>
  );
}
