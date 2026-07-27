import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';

describe('CORS (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.AUTH0_DOMAIN = 'dev-yg.us.auth0.com';
    process.env.AUTH0_AUDIENCE = 'https://bbl-candidate-test-api';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows the frontend dev origin on a simple request, even when the response is a 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('responds to a CORS preflight OPTIONS request for the frontend origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/collections')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('never echoes back an arbitrary third-party origin (fixed allow-list, not a reflection)', async () => {
    // With a static configured origin, the `cors` package always returns
    // that one fixed value (never echoes the request's actual Origin) —
    // a browser at evil.example.com would reject this response itself,
    // since the header doesn't match its own origin. What matters here is
    // that the header can never be made to equal an arbitrary origin.
    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Origin', 'http://evil.example.com');

    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
