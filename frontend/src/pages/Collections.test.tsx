import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Collections } from './Collections';

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../api/client', () => ({ apiClient: apiClientMock }));

function collection(overrides: Partial<{ id: string; name: string }> = {}) {
  return {
    id: '1',
    name: 'Reading',
    ownerId: 'auth0|u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Collections />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiClientMock.get.mockReset();
  apiClientMock.post.mockReset();
  apiClientMock.patch.mockReset();
  apiClientMock.delete.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Collections — loading', () => {
  it('loads and displays collections on mount', async () => {
    apiClientMock.get.mockResolvedValue([collection()]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Reading')).toBeInTheDocument(),
    );
    expect(apiClientMock.get).toHaveBeenCalledWith('/collections');
  });

  it('shows an empty state when there are no collections', async () => {
    apiClientMock.get.mockResolvedValue([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no collections yet/i)).toBeInTheDocument(),
    );
  });

  it('shows an error message when loading fails', async () => {
    apiClientMock.get.mockRejectedValue(new Error('Request failed'));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Request failed')).toBeInTheDocument(),
    );
  });
});

describe('Collections — create', () => {
  it('creates a new collection and shows it in the list', async () => {
    apiClientMock.get.mockResolvedValueOnce([]);
    apiClientMock.post.mockResolvedValue(collection());
    apiClientMock.get.mockResolvedValueOnce([collection()]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no collections yet/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /new collection/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Reading' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(apiClientMock.post).toHaveBeenCalledWith('/collections', {
        name: 'Reading',
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('Reading')).toBeInTheDocument(),
    );
  });
});

describe('Collections — edit', () => {
  it('edits an existing collection', async () => {
    apiClientMock.get.mockResolvedValueOnce([collection()]);
    apiClientMock.patch.mockResolvedValue(collection({ name: 'Renamed' }));
    apiClientMock.get.mockResolvedValueOnce([collection({ name: 'Renamed' })]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Reading')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /edit reading/i }));
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(apiClientMock.patch).toHaveBeenCalledWith('/collections/1', {
        name: 'Renamed',
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('Renamed')).toBeInTheDocument(),
    );
  });
});

describe('Collections — delete', () => {
  it('deletes a collection after confirmation', async () => {
    apiClientMock.get.mockResolvedValueOnce([collection()]);
    apiClientMock.delete.mockResolvedValue(undefined);
    apiClientMock.get.mockResolvedValueOnce([]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Reading')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /delete reading/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() =>
      expect(apiClientMock.delete).toHaveBeenCalledWith('/collections/1'),
    );
    await waitFor(() =>
      expect(screen.getByText(/no collections yet/i)).toBeInTheDocument(),
    );
  });

  it('does not delete when the confirmation dialog is cancelled', async () => {
    apiClientMock.get.mockResolvedValue([collection()]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Reading')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /delete reading/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(apiClientMock.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Reading')).toBeInTheDocument();
  });
});
