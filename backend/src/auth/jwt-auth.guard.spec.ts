import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    guard = new JwtAuthGuard();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs exactly "Auth success" (no other values) and returns the user on success', () => {
    const user = { sub: 'auth0|abc' };

    const result = guard.handleRequest(null, user, null, {} as any);

    expect(result).toBe(user);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('Auth success');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('logs exactly "Auth failed" (no reason/token) and throws when there is no user', () => {
    expect(() =>
      guard.handleRequest(null, false, { message: 'jwt expired' }, {} as any),
    ).toThrow(UnauthorizedException);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('Auth failed');
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs exactly "Auth failed" (no error detail) and rethrows when passport passes an error', () => {
    const err = new Error('boom');

    expect(() => guard.handleRequest(err, null, null, {} as any)).toThrow(err);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('Auth failed');
  });
});
