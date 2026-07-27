import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const originalDomain = process.env.AUTH0_DOMAIN;
  const originalAudience = process.env.AUTH0_AUDIENCE;

  afterEach(() => {
    process.env.AUTH0_DOMAIN = originalDomain;
    process.env.AUTH0_AUDIENCE = originalAudience;
  });

  it('throws at construction if AUTH0_DOMAIN is not set', () => {
    delete process.env.AUTH0_DOMAIN;
    process.env.AUTH0_AUDIENCE = 'https://bbl-candidate-test-api';

    expect(() => new JwtStrategy()).toThrow(/AUTH0_DOMAIN/);
  });

  it('throws at construction if AUTH0_AUDIENCE is not set', () => {
    process.env.AUTH0_DOMAIN = 'dev-yg.us.auth0.com';
    delete process.env.AUTH0_AUDIENCE;

    expect(() => new JwtStrategy()).toThrow(/AUTH0_AUDIENCE/);
  });
});
