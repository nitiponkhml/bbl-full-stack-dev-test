import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthCallbackError } from '../auth/callback';
import { Callback } from './Callback';

const { handleAuthCallbackMock } = vi.hoisted(() => ({
  handleAuthCallbackMock: vi.fn(),
}));

vi.mock('../auth/callback', async () => {
  const actual =
    await vi.importActual<typeof import('../auth/callback')>(
      '../auth/callback',
    );
  return { ...actual, handleAuthCallback: handleAuthCallbackMock };
});

vi.mock('../auth/config', () => ({
  getAuth0Config: () => ({
    domain: 'dev-yg.us.auth0.com',
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:3000/callback',
    audience: 'https://bbl-candidate-test-api',
  }),
}));

function renderCallback(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/callback" element={<Callback />} />
        <Route path="/collections" element={<div>Collections page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  handleAuthCallbackMock.mockReset();
  window.history.replaceState({}, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Callback', () => {
  it('shows a loading state before the exchange resolves', () => {
    handleAuthCallbackMock.mockReturnValue(new Promise(() => {}));
    renderCallback('/callback?code=abc&state=xyz');
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument();
  });

  it('navigates to /collections after a successful exchange', async () => {
    handleAuthCallbackMock.mockResolvedValue(undefined);
    renderCallback('/callback?code=abc&state=xyz');

    await waitFor(() =>
      expect(screen.getByText('Collections page')).toBeInTheDocument(),
    );
  });

  it('shows the error message when the exchange fails', async () => {
    handleAuthCallbackMock.mockRejectedValue(
      new AuthCallbackError('State mismatch on callback'),
    );
    renderCallback('/callback?code=abc&state=xyz');

    await waitFor(() =>
      expect(
        screen.getByText('State mismatch on callback'),
      ).toBeInTheDocument(),
    );
  });

  it('scrubs code/state from the URL after processing (success)', async () => {
    handleAuthCallbackMock.mockResolvedValue(undefined);
    renderCallback('/callback?code=abc&state=xyz');

    await waitFor(() =>
      expect(screen.getByText('Collections page')).toBeInTheDocument(),
    );
    expect(window.location.search).toBe('');
  });

  it('scrubs code/state from the URL after processing (failure)', async () => {
    handleAuthCallbackMock.mockRejectedValue(new AuthCallbackError('boom'));
    renderCallback('/callback?code=abc&state=xyz');

    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
    expect(window.location.search).toBe('');
  });

  it('does not call handleAuthCallback more than once (React StrictMode double-invoke guard)', async () => {
    handleAuthCallbackMock.mockResolvedValue(undefined);
    renderCallback('/callback?code=abc&state=xyz');

    await waitFor(() =>
      expect(screen.getByText('Collections page')).toBeInTheDocument(),
    );
    expect(handleAuthCallbackMock).toHaveBeenCalledTimes(1);
  });
});
