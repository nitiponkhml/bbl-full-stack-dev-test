import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { RequireAuth } from './RequireAuth';
import { setAccessToken } from './tokenStorage';

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/" element={<div>Landing page</div>} />
        <Route
          path="/protected"
          element={
            <RequireAuth>
              <div>Protected content</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function futureToken(): string {
  const expSeconds = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ exp: expSeconds })).replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function expiredToken(): string {
  const expSeconds = Math.floor(Date.now() / 1000) - 3600;
  const payload = btoa(JSON.stringify({ exp: expSeconds })).replace(/=+$/, '');
  return `header.${payload}.signature`;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('RequireAuth', () => {
  it('renders the protected content when a valid, non-expired token exists', () => {
    setAccessToken(futureToken());
    renderProtected();
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to / when no token is stored', () => {
    renderProtected();
    expect(screen.getByText('Landing page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects to / when the stored token is expired', () => {
    setAccessToken(expiredToken());
    renderProtected();
    expect(screen.getByText('Landing page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
