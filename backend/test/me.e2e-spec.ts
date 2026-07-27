import { generateKeyPairSync, KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';
import nock from 'nock';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const AUTH0_DOMAIN = 'dev-yg.us.auth0.com';
const AUDIENCE = 'https://bbl-candidate-test-api';
const ISSUER = `https://${AUTH0_DOMAIN}/`;

function toJwk(publicKey: KeyObject, kid: string) {
  return { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
}

describe('GET /me (e2e)', () => {
  let app: INestApplication;
  let key: { privateKey: KeyObject; publicKey: KeyObject };

  beforeAll(async () => {
    process.env.AUTH0_DOMAIN = AUTH0_DOMAIN;
    process.env.AUTH0_AUDIENCE = AUDIENCE;

    key = generateKeyPairSync('rsa', { modulusLength: 2048 });

    nock(`https://${AUTH0_DOMAIN}`)
      .persist()
      .get('/.well-known/jwks.json')
      .reply(200, { keys: [toJwk(key.publicKey, 'key-a')] });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
  });

  it('rejects a request with no Authorization header', async () => {
    await request(app.getHttpServer()).get('/me').expect(401);
  });

  it('returns the sub claim from a valid Access Token', async () => {
    const token = jwt.sign({ sub: 'auth0|62e089faea483987422db6cc' }, key.privateKey, {
      algorithm: 'RS256',
      keyid: 'key-a',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '1h',
    });

    const res = await request(app.getHttpServer())
      .get('/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual({ sub: 'auth0|62e089faea483987422db6cc' });
  });
});
