import { describe, expect, it } from 'vitest';
import { decodeJwtPayload, isTokenExpired } from './jwt';

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeToken(payload: object): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('decodeJwtPayload', () => {
  it('decodes the payload segment of a well-formed JWT', () => {
    const token = makeToken({ sub: 'auth0|abc123', exp: 9999999999 });
    expect(decodeJwtPayload(token)).toEqual({
      sub: 'auth0|abc123',
      exp: 9999999999,
    });
  });

  it('returns null for a token that is not three dot-separated segments', () => {
    expect(decodeJwtPayload('not-a-jwt')).toBeNull();
  });

  it('returns null when the payload segment is not valid base64url', () => {
    expect(decodeJwtPayload('header.###.signature')).toBeNull();
  });

  it('returns null when the decoded payload is not valid JSON', () => {
    const notJson = base64UrlEncode('this is not json');
    expect(decodeJwtPayload(`header.${notJson}.signature`)).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('returns false for a token whose exp is in the future', () => {
    const futureSeconds = Math.floor(Date.now() / 1000) + 3600;
    const token = makeToken({ exp: futureSeconds });
    expect(isTokenExpired(token)).toBe(false);
  });

  it('returns true for a token whose exp is in the past', () => {
    const pastSeconds = Math.floor(Date.now() / 1000) - 3600;
    const token = makeToken({ exp: pastSeconds });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('fails safe (treats as expired) when the token has no exp claim', () => {
    const token = makeToken({ sub: 'auth0|abc123' });
    expect(isTokenExpired(token)).toBe(true);
  });

  it('fails safe (treats as expired) for a malformed token', () => {
    expect(isTokenExpired('garbage')).toBe(true);
  });

  it('fails safe (treats as expired) for a null token', () => {
    expect(isTokenExpired(null)).toBe(true);
  });
});
