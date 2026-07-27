import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { setAccessToken } from './auth/tokenStorage';

function futureToken(): string {
  const expSeconds = Math.floor(Date.now() / 1000) + 3600;
  const payload = btoa(JSON.stringify({ exp: expSeconds })).replace(/=+$/, '');
  return `header.${payload}.signature`;
}

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  window.history.pushState({}, '', '/');
});

describe('App routing', () => {
  it('shows the landing page at /', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('redirects /collections to the landing page when unauthenticated', () => {
    window.history.pushState({}, '', '/collections');
    render(<App />);
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('renders the Collections page at /collections when authenticated', () => {
    setAccessToken(futureToken());
    window.history.pushState({}, '', '/collections');
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /collections/i }),
    ).toBeInTheDocument();
  });

  it('redirects /bookmarks to the landing page when unauthenticated', () => {
    window.history.pushState({}, '', '/bookmarks');
    render(<App />);
    expect(
      screen.getByRole('button', { name: /sign in/i }),
    ).toBeInTheDocument();
  });

  it('renders the Bookmarks page at /bookmarks when authenticated', () => {
    setAccessToken(futureToken());
    window.history.pushState({}, '', '/bookmarks');
    render(<App />);
    expect(
      screen.getByRole('heading', { name: /bookmarks/i }),
    ).toBeInTheDocument();
  });
});
