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

  it('shows the bookmark notes in the list when present', async () => {
    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.resolve([])
        : Promise.resolve([bookmark({ notes: 'Read this later' })]),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Read this later')).toBeInTheDocument(),
    );
  });

  it('does not render a notes line when notes is null', async () => {
    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.resolve([])
        : Promise.resolve([bookmark({ notes: null })]),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Example')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('bookmark-notes')).not.toBeInTheDocument();
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

  it('does not crash or leave an unhandled rejection when the collections dropdown fails to load', async () => {
    const nodeProcess = (
      globalThis as unknown as {
        process: {
          on: (event: string, listener: (reason: unknown) => void) => void;
          off: (event: string, listener: (reason: unknown) => void) => void;
        };
      }
    ).process;
    const unhandled = vi.fn();
    nodeProcess.on('unhandledRejection', unhandled);

    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.reject(new Error('collections down'))
        : Promise.resolve([]),
    );
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no bookmarks yet/i)).toBeInTheDocument(),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(unhandled).not.toHaveBeenCalled();
    nodeProcess.off('unhandledRejection', unhandled);
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

  it('shows an error and keeps the dialog open when creating fails', async () => {
    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.resolve([])
        : Promise.resolve([]),
    );
    apiClientMock.post.mockRejectedValue(new Error('Bad URL'));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/no bookmarks yet/i)).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /new bookmark/i }));
    fireEvent.change(screen.getByLabelText(/^url$/i), {
      target: { value: 'not-a-url' },
    });
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Example' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() =>
      expect(screen.getByText('Bad URL')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
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

  it('shows an error when deleting fails', async () => {
    apiClientMock.get.mockImplementation((path: string) =>
      path.startsWith('/collections')
        ? Promise.resolve([])
        : Promise.resolve([bookmark()]),
    );
    apiClientMock.delete.mockRejectedValue(new Error('Delete failed'));
    renderPage();

    await waitFor(() =>
      expect(screen.getByText('Example')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /delete example/i }));
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() =>
      expect(screen.getByText('Delete failed')).toBeInTheDocument(),
    );
    expect(screen.getByText('Example')).toBeInTheDocument();
  });
});
