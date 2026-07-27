import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bookmarks } from './Bookmarks';

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../api/client', () => ({ apiClient: apiClientMock }));

function bookmark(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '1',
    url: 'https://example.com',
    title: 'Example',
    notes: null,
    collectionId: null,
    ownerId: 'auth0|u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage(entry = '/bookmarks') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Bookmarks />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  apiClientMock.get.mockReset();
  apiClientMock.post.mockReset();
  apiClientMock.patch.mockReset();
  apiClientMock.delete.mockReset();
  apiClientMock.get.mockImplementation((path: string) =>
    path.startsWith('/collections') ? Promise.resolve([]) : Promise.resolve([]),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Bookmarks — loading', () => {
  it('loads and displays bookmarks on mount', async () => {
    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.resolve([])
        : Promise.resolve([bookmark()]),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Example')).toBeInTheDocument(),
    );
    expect(apiClientMock.get).toHaveBeenCalledWith('/bookmarks');
  });

  it('shows an empty state when there are no bookmarks', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/no bookmarks yet/i)).toBeInTheDocument(),
    );
  });

  it('shows an error message when loading fails', async () => {
    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.resolve([])
        : Promise.reject(new Error('Request failed')),
    );
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Request failed')).toBeInTheDocument(),
    );
  });

  it('filters by collectionId when present in the URL query string', async () => {
    renderPage('/bookmarks?collectionId=abc');
    await waitFor(() =>
      expect(apiClientMock.get).toHaveBeenCalledWith(
        '/bookmarks?collectionId=abc',
      ),
    );
  });
});

describe('Bookmarks — create', () => {
  it('creates a new bookmark and shows it in the list', async () => {
    apiClientMock.get
      .mockImplementationOnce(() => Promise.resolve([])) // collections
      .mockImplementationOnce(() => Promise.resolve([])); // bookmarks (empty)
    apiClientMock.post.mockResolvedValue(bookmark());
    apiClientMock.get.mockImplementationOnce(() =>
      Promise.resolve([bookmark()]),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no bookmarks yet/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /new bookmark/i }));
    fireEvent.change(screen.getByLabelText(/^url$/i), {
      target: { value: 'https://example.com' },
    });
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(apiClientMock.post).toHaveBeenCalledWith('/bookmarks', {
        url: 'https://example.com',
        title: 'Example',
        notes: null,
        collectionId: null,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('Example')).toBeInTheDocument(),
    );
  });
});

describe('Bookmarks — edit', () => {
  it('edits an existing bookmark', async () => {
    apiClientMock.get
      .mockImplementationOnce(() => Promise.resolve([])) // collections
      .mockImplementationOnce(() => Promise.resolve([bookmark()])); // bookmarks
    apiClientMock.patch.mockResolvedValue(bookmark({ title: 'Renamed' }));
    apiClientMock.get.mockImplementationOnce(() =>
      Promise.resolve([bookmark({ title: 'Renamed' })]),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Example')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /edit example/i }));
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Renamed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(apiClientMock.patch).toHaveBeenCalledWith('/bookmarks/1', {
        url: 'https://example.com',
        title: 'Renamed',
        notes: null,
        collectionId: null,
      }),
    );
    await waitFor(() =>
      expect(screen.getByText('Renamed')).toBeInTheDocument(),
    );
  });
});

describe('Bookmarks — delete', () => {
  it('deletes a bookmark after confirmation', async () => {
    apiClientMock.get
      .mockImplementationOnce(() => Promise.resolve([])) // collections
      .mockImplementationOnce(() => Promise.resolve([bookmark()])); // bookmarks
    apiClientMock.delete.mockResolvedValue(undefined);
    apiClientMock.get.mockImplementationOnce(() => Promise.resolve([]));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Example')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /delete example/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() =>
      expect(apiClientMock.delete).toHaveBeenCalledWith('/bookmarks/1'),
    );
    await waitFor(() =>
      expect(screen.getByText(/no bookmarks yet/i)).toBeInTheDocument(),
    );
  });

  it('does not delete when the confirmation dialog is cancelled', async () => {
    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.resolve([])
        : Promise.resolve([bookmark()]),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Example')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /delete example/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(apiClientMock.delete).not.toHaveBeenCalled();
    expect(screen.getByText('Example')).toBeInTheDocument();
  });
});
