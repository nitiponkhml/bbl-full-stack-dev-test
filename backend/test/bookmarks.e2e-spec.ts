import { generateKeyPairSync, KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';
import nock from 'nock';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';

const AUTH0_DOMAIN = 'dev-yg.us.auth0.com';
const AUDIENCE = 'https://bbl-candidate-test-api';
const ISSUER = `https://${AUTH0_DOMAIN}/`;

const OWNER_A = 'auth0|test-bookmarks-owner-a';
const OWNER_B = 'auth0|test-bookmarks-owner-b';

function toJwk(publicKey: KeyObject, kid: string) {
  return { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
}

describe('/bookmarks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let key: { privateKey: KeyObject; publicKey: KeyObject };

  function tokenFor(sub: string) {
    return jwt.sign({ sub }, key.privateKey, {
      algorithm: 'RS256',
      keyid: 'key-a',
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: '1h',
    });
  }

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
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.bookmark.deleteMany({ where: { ownerId: { in: [OWNER_A, OWNER_B] } } });
    await prisma.collection.deleteMany({ where: { ownerId: { in: [OWNER_A, OWNER_B] } } });
  });

  afterAll(async () => {
    await app.close();
    nock.cleanAll();
  });

  describe('POST /bookmarks', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/bookmarks')
        .send({ url: 'https://example.com', title: 'Example' })
        .expect(401);
    });

    it('creates a bookmark owned by the caller', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'https://example.com', title: 'Example' })
        .expect(201);

      expect(res.body).toMatchObject({
        url: 'https://example.com',
        title: 'Example',
        ownerId: OWNER_A,
        collectionId: null,
      });
      expect(res.body.id).toEqual(expect.any(String));
    });

    it('returns 400 when url and title are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({})
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('returns 400 for a malformed url (no protocol)', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'example.com', title: 'Example' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });

    it('returns 400 when the body contains an unrecognized field (e.g. a spoofed ownerId)', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'https://example.com', title: 'Example', ownerId: 'auth0|spoofed' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });

    it('creates a bookmark inside a collection owned by the caller', async () => {
      const collection = await prisma.collection.create({
        data: { name: 'Mine', ownerId: OWNER_A },
      });

      const res = await request(app.getHttpServer())
        .post('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'https://example.com', title: 'Example', collectionId: collection.id })
        .expect(201);

      expect(res.body.collectionId).toBe(collection.id);
    });

    it("returns 404 when collectionId belongs to another user", async () => {
      const collection = await prisma.collection.create({
        data: { name: "B's collection", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .post('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'https://example.com', title: 'Example', collectionId: collection.id })
        .expect(404);
    });

    it('returns 404 when collectionId does not exist', async () => {
      await request(app.getHttpServer())
        .post('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({
          url: 'https://example.com',
          title: 'Example',
          collectionId: '00000000-0000-0000-0000-000000000000',
        })
        .expect(404);
    });
  });

  describe('GET /bookmarks', () => {
    it("only returns the caller's own bookmarks", async () => {
      await prisma.bookmark.createMany({
        data: [
          { url: 'https://a.example.com', title: 'A bookmark', ownerId: OWNER_A },
          { url: 'https://b.example.com', title: 'B bookmark', ownerId: OWNER_B },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/bookmarks')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ url: 'https://a.example.com', ownerId: OWNER_A });
    });

    it('supports the ?collectionId= filter', async () => {
      const collection = await prisma.collection.create({
        data: { name: 'Mine', ownerId: OWNER_A },
      });
      await prisma.bookmark.createMany({
        data: [
          {
            url: 'https://in.example.com',
            title: 'In collection',
            ownerId: OWNER_A,
            collectionId: collection.id,
          },
          { url: 'https://out.example.com', title: 'Uncategorised', ownerId: OWNER_A },
        ],
      });

      const res = await request(app.getHttpServer())
        .get(`/bookmarks?collectionId=${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].url).toBe('https://in.example.com');
    });
  });

  describe('GET /bookmarks/:id', () => {
    it('returns the bookmark when owned by the caller', async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://example.com', title: 'Mine', ownerId: OWNER_A },
      });

      const res = await request(app.getHttpServer())
        .get(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toMatchObject({ id: bookmark.id, title: 'Mine' });
    });

    it("returns 404 (not 403) for another user's bookmark", async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://secret.example.com', title: "B's bookmark", ownerId: OWNER_B },
      });

      const res = await request(app.getHttpServer())
        .get(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'Bookmark not found',
        error: 'Not Found',
      });
    });

    it('returns 404 for a non-existent id', async () => {
      await request(app.getHttpServer())
        .get('/bookmarks/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(404);
    });
  });

  describe('PUT /bookmarks/:id', () => {
    it('fully updates a bookmark owned by the caller', async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://old.example.com', title: 'Old', notes: 'old notes', ownerId: OWNER_A },
      });

      const res = await request(app.getHttpServer())
        .put(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'https://new.example.com', title: 'New' })
        .expect(200);

      expect(res.body).toMatchObject({ url: 'https://new.example.com', title: 'New' });
    });

    it("returns 404 when the bookmark belongs to another user and does not modify it", async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://secret.example.com', title: "B's bookmark", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .put(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'https://hijacked.example.com', title: 'Hijacked' })
        .expect(404);

      const untouched = await prisma.bookmark.findUnique({ where: { id: bookmark.id } });
      expect(untouched?.title).toBe("B's bookmark");
    });

    it("returns 404 when moving into another user's collection", async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://example.com', title: 'Mine', ownerId: OWNER_A },
      });
      const foreignCollection = await prisma.collection.create({
        data: { name: "B's collection", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .put(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ url: 'https://example.com', title: 'Mine', collectionId: foreignCollection.id })
        .expect(404);
    });
  });

  describe('PATCH /bookmarks/:id', () => {
    it('partially updates a bookmark owned by the caller', async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://example.com', title: 'Old title', ownerId: OWNER_A },
      });

      const res = await request(app.getHttpServer())
        .patch(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ title: 'Patched title' })
        .expect(200);

      expect(res.body).toMatchObject({ title: 'Patched title', url: 'https://example.com' });
    });

    it("returns 404 when the bookmark belongs to another user", async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://secret.example.com', title: "B's bookmark", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .patch(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ title: 'Hijacked' })
        .expect(404);
    });
  });

  describe('DELETE /bookmarks/:id', () => {
    it('deletes a bookmark owned by the caller', async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://example.com', title: 'To delete', ownerId: OWNER_A },
      });

      await request(app.getHttpServer())
        .delete(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(204);

      const deleted = await prisma.bookmark.findUnique({ where: { id: bookmark.id } });
      expect(deleted).toBeNull();
    });

    it("returns 404 when the bookmark belongs to another user and does not delete it", async () => {
      const bookmark = await prisma.bookmark.create({
        data: { url: 'https://secret.example.com', title: "B's bookmark", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .delete(`/bookmarks/${bookmark.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(404);

      const stillThere = await prisma.bookmark.findUnique({ where: { id: bookmark.id } });
      expect(stillThere).not.toBeNull();
    });
  });
});
