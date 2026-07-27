import { Alert, CircularProgress, Container, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { handleAuthCallback } from '../auth/callback';
import { getAuth0Config } from '../auth/config';

/**
 * /callback — receives the authorization code from Auth0, exchanges it for
 * tokens, then redirects to /collections (per DECISIONS.md's "Frontend
 * routing" decision). The code/state query params are one-time-use, so
 * they're scrubbed from the address bar once handled either way.
 */
export function Callback(): ReactElement {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    handleAuthCallback(getAuth0Config(), searchParams)
      .then(() => {
        window.history.replaceState({}, '', window.location.pathname);
        navigate('/collections', { replace: true });
      })
      .catch((error: unknown) => {
        window.history.replaceState({}, '', window.location.pathname);
        setErrorMessage(
          error instanceof Error ? error.message : 'Login failed',
        );
      });
    // Deliberately empty deps — this must run exactly once per mount, since
    // the callback's code/state are one-time-use (re-running with the same
    // params on a dependency change would fail state validation).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errorMessage) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Alert severity="error">{errorMessage}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <CircularProgress />
      <Typography sx={{ mt: 2 }}>Signing you in…</Typography>
    </Container>
  );
}
