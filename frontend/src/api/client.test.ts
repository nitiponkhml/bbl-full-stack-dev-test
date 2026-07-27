import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from './client';
import { getAccessToken, setAccessToken } from '../auth/tokenStorage';

function stubLocationAssign() {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  });
  return assign;
}

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('apiClient.get', () => {
  it('sends a Bearer Authorization header from the stored access token', async () => {
    setAccessToken('the-access-token');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: '1' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/collections');

    const [, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options.headers);
    expect(headers.get('Authorization')).toBe('Bearer the-access-token');
  });

  it('does not send an Authorization header when no token is stored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/collections');

    const [, options] = fetchMock.mock.calls[0];
    const headers = new Headers(options.headers);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('requests the correct URL (base URL + path) with GET', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.get('/collections');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3001/collections');
    expect(options.method).toBe('GET');
  });

  it('returns the parsed JSON body on success', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { id: '1', name: 'Reading' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.get('/collections/1');

    expect(result).toEqual({ id: '1', name: 'Reading' });
  });
});

describe('apiClient.post/put/patch', () => {
  it('sends a JSON body with Content-Type application/json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { id: '1' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.post('/collections', { name: 'Reading' });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:3001/collections');
    expect(options.method).toBe('POST');
    const headers = new Headers(options.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ name: 'Reading' });
  });

  it('put sends PUT with a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: '1' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.put('/collections/1', { name: 'Renamed' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ name: 'Renamed' });
  });

  it('patch sends PATCH with a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: '1' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiClient.patch('/collections/1', { name: 'Renamed' });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body)).toEqual({ name: 'Renamed' });
  });
});

describe('apiClient.delete', () => {
  it('sends DELETE and returns undefined on a 204 response without parsing a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 204,
      ok: true,
      json: () => Promise.reject(new Error('should not be called on 204')),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiClient.delete('/collections/1');

    expect(result).toBeUndefined();
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('DELETE');
  });
});

describe('error handling', () => {
  it('throws ApiError using the backend error shape {statusCode, message, error}', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(404, {
          statusCode: 404,
          message: 'Collection not found',
          error: 'Not Found',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/collections/foreign-id')).rejects.toThrow(
      ApiError,
    );
    await expect(apiClient.get('/collections/foreign-id')).rejects.toThrow(
      'Collection not found',
    );
  });

  it('throws a generic ApiError when the error body cannot be parsed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      json: () => Promise.reject(new SyntaxError('bad json')),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/collections')).rejects.toThrow(ApiError);
  });

  it('wraps a network-level fetch failure into a generic ApiError (no raw browser error leaked)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    let caught: unknown;
    try {
      await apiClient.get('/collections');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as Error).message).not.toBe('Failed to fetch');
  });

  it('on a 401, clears the stored access token and redirects to / (session expired)', async () => {
    setAccessToken('a-now-invalid-token');
    const assignSpy = stubLocationAssign();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(401, {
          statusCode: 401,
          message: 'Unauthorized',
          error: 'Unauthorized',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiClient.get('/collections')).rejects.toThrow(ApiError);

    expect(getAccessToken()).toBeNull();
    expect(assignSpy).toHaveBeenCalledWith('/');
  });
});
