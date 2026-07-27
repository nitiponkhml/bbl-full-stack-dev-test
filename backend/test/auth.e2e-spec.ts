import { generateKeyPairSync, KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';
import nock from 'nock';
import { Controller, Get, INestApplication, Module, Req, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

const AUTH0_DOMAIN = 'dev-yg.us.auth0.com';
const AUDIENCE = 'https://bbl-candidate-test-api';
const ISSUER = `https://${AUTH0_DOMAIN}/`;

@Controller('protected')
class ProtectedTestController {
  @Get()
  @UseGuards(JwtAuthGuard)
  get(@Req() req: any) {
    return { sub: req.user.sub };
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ProtectedTestController],
})
class TestAppModule {}

function toJwk(publicKey: KeyObject, kid: string) {
  return { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
}

describe('JWT auth guard (e2e)', () => {
  let app: INestApplication;
  let keyA: { privateKey: KeyObject; publicKey: KeyObject };
  let keyB: { privateKey: KeyObject; publicKey: KeyObject };

  beforeAll(async () => {
    process.env.AUTH0_DOMAIN = AUTH0_DOMAIN;
    process.env.AUTH0_AUDIENCE = AUDIENCE;

    keyA = generateKeyPairSync('rsa', { modulusLength: 2048 });
    keyB = generateKeyPairSync('rsa', { modulusLength: 2048 });

    nock(`https://${AUTH0_DOMAIN}`)
      .persist()
      .get('/.well-known/jwks.json')
      .reply(200, {
        keys: [toJwk(keyA.publicKey, 'key-a'), toJwk(keyB.publicKey, 'key-b')],
      });

    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
  });

  it('rejects a request with no Authorization header', async () => {
    await request(app.getHttpServer()).get('/protected').expect(401);
  });

  it('rejects a malformed bearer token', async () => {
    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .expect(401);
  });

  it('rejects a token signed with a key not published in the JWKS', async () => {
    const untrustedKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const token = jwt.sign({ sub: 'auth0|attacker' }, untrustedKey.privateKey, {
      algorithm: 'RS256',
      keyid: 'key-a', // claims to be signed by the trusted key, but isn't
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '1h',
    });

    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects an expired token without leaking internal error details in the response body', async () => {
    const token = jwt.sign(
      { sub: 'auth0|expired-user' },
      keyA.privateKey,
      {
        algorithm: 'RS256',
        keyid: 'key-a',
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: -60, // expired 60 seconds ago
      },
    );

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    expect(JSON.stringify(res.body)).not.toMatch(/jwt|expired|signature|malformed/i);
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = jwt.sign({ sub: 'auth0|some-user' }, keyA.privateKey, {
      algorithm: 'RS256',
      keyid: 'key-a',
      issuer: 'https://not-our-tenant.example.com/',
      audience: AUDIENCE,
      expiresIn: '1h',
    });

    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('rejects a token with the wrong audience (e.g. an ID Token, whose aud is the client_id)', async () => {
    const token = jwt.sign({ sub: 'auth0|some-user' }, keyA.privateKey, {
      algorithm: 'RS256',
      keyid: 'key-a',
      issuer: ISSUER,
      audience: 'some-frontend-client-id', // ID Token's aud, not our API audience
      expiresIn: '1h',
    });

    await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('accepts a valid token and exposes sub on the request', async () => {
    const token = jwt.sign({ sub: 'auth0|62e089faea483987422db6cc' }, keyA.privateKey, {
      algorithm: 'RS256',
      keyid: 'key-a',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '1h',
    });

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ sub: 'auth0|62e089faea483987422db6cc' });
  });

  it('accepts a valid token signed with the second published key (key rotation)', async () => {
    const token = jwt.sign({ sub: 'auth0|rotated-key-user' }, keyB.privateKey, {
      algorithm: 'RS256',
      keyid: 'key-b',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '1h',
    });

    const res = await request(app.getHttpServer())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ sub: 'auth0|rotated-key-user' });
  });
});
