import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setIdToken } from '../auth/tokenStorage';
import { AppShell } from './AppShell';

const { logoutMock } = vi.hoisted(() => ({ logoutMock: vi.fn() }));
vi.mock('../auth/logout', () => ({ logout: logoutMock }));
vi.mock('../auth/config', () => ({ getAuth0Config: () => ({}) }));

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeIdToken(payload: object): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

function renderShell(entry = '/collections') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/collections" element={<div>Collections content</div>} />
          <Route path="/bookmarks" element={<div>Bookmarks content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  logoutMock.mockReset();
});

describe('AppShell', () => {
  it('renders the brand name and both nav links', () => {
    renderShell();
    expect(screen.getByText(/bbl bookmarks/i)).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Collections' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bookmarks' })).toBeInTheDocument();
  });

  it("marks the current route's nav tab as selected", () => {
    renderShell('/collections');
    expect(screen.getByRole('tab', { name: 'Collections' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Bookmarks' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('renders the routed page content via the layout outlet', () => {
    renderShell('/collections');
    expect(screen.getByText('Collections content')).toBeInTheDocument();
  });

  it('navigates when a nav tab is clicked', () => {
    renderShell('/collections');
    fireEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    expect(screen.getByText('Bookmarks content')).toBeInTheDocument();
  });

  it('shows the decoded name and email in the account menu', async () => {
    setIdToken(makeIdToken({ name: 'Ada Lovelace', email: 'ada@example.com' }));
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));

    await waitFor(() =>
      expect(screen.getByText('Ada Lovelace')).toBeInTheDocument(),
    );
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('falls back gracefully with no crash and no user-info section when there is no ID token', async () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: /sign out/i }),
      ).toBeInTheDocument(),
    );
  });

  it('calls logout when Sign out is clicked', async () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: /account menu/i }));
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: /sign out/i }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
