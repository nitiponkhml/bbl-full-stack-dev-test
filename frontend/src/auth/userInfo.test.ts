import { beforeEach, describe, expect, it } from 'vitest';
import { getUserInfo } from './userInfo';
import { setIdToken } from './tokenStorage';

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeIdToken(payload: object): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('getUserInfo', () => {
  it('returns null when no ID token is stored', () => {
    expect(getUserInfo()).toBeNull();
  });

  it('returns null when the stored token is malformed', () => {
    setIdToken('not-a-jwt');
    expect(getUserInfo()).toBeNull();
  });

  it('extracts name, email, and picture from the ID token payload', () => {
    setIdToken(
      makeIdToken({
        sub: 'auth0|abc123',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        picture: 'https://example.com/ada.png',
      }),
    );

    expect(getUserInfo()).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      picture: 'https://example.com/ada.png',
    });
  });

  it('returns null for individual claims that are missing', () => {
    setIdToken(makeIdToken({ sub: 'auth0|abc123' }));

    expect(getUserInfo()).toEqual({ name: null, email: null, picture: null });
  });
});
