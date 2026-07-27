import { Button, Container, Typography } from '@mui/material';
import type { ReactElement } from 'react';
import { getAuth0Config } from '../auth/config';
import { logout } from '../auth/logout';

// Placeholder — full bookmarks CRUD UI is separate follow-up work.
// Exists now so /bookmarks (a route RequireAuth protects) has content.
export function Bookmarks(): ReactElement {
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Bookmarks
      </Typography>
      <Button variant="outlined" onClick={() => logout(getAuth0Config())}>
        Sign out
      </Button>
    </Container>
  );
}
