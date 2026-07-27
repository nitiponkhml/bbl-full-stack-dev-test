import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from '../auth/tokenStorage';
import { Landing } from './Landing';

function stubLocationAssign() {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  return assign;
}

function futureToken(): string {
  const expSeconds = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ exp: expSeconds })).replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/collections" element={<div>Collections page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv('VITE_AUTH0_DOMAIN', 'dev-yg.us.auth0.com');
  vi.stubEnv('VITE_AUTH0_CLIENT_ID', 'test-client-id');
  vi.stubEnv('VITE_AUTH0_REDIRECT_URI', 'http://localhost:3000/callback');
  vi.stubEnv('VITE_AUTH0_AUDIENCE', 'https://bbl-candidate-test-api');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Landing', () => {
  it('shows a Sign in button when no token is present', () => {
    renderLanding();
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('redirects to /collections when a valid, non-expired token is present', () => {
    setAccessToken(futureToken());
    renderLanding();
    expect(screen.getByText('Collections page')).toBeInTheDocument();
  });

  it('starts the Auth0 login redirect when Sign in is clicked', async () => {
    const assignSpy = stubLocationAssign();
    renderLanding();

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(assignSpy).toHaveBeenCalledTimes(1));
    const url = new URL(assignSpy.mock.calls[0][0]);
    expect(url.origin).toBe('https://dev-yg.us.auth0.com');
    expect(url.pathname).toBe('/authorize');
  });
});
