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

const OWNER_A = 'auth0|test-collections-owner-a';
const OWNER_B = 'auth0|test-collections-owner-b';

function toJwk(publicKey: KeyObject, kid: string) {
  return { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };
}

describe('/collections (e2e)', () => {
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

  describe('POST /collections', () => {
    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).post('/collections').send({ name: 'Reading' }).expect(401);
    });

    it('creates a collection owned by the caller', async () => {
      const res = await request(app.getHttpServer())
        .post('/collections')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ name: 'Reading' })
        .expect(201);

      expect(res.body).toMatchObject({ name: 'Reading', ownerId: OWNER_A });
      expect(res.body.id).toEqual(expect.any(String));
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/collections')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({})
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(Array.isArray(res.body.message)).toBe(true);
    });

    it('returns 400 when the body contains an unrecognized field (e.g. a spoofed ownerId)', async () => {
      const res = await request(app.getHttpServer())
        .post('/collections')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ name: 'Reading', ownerId: 'auth0|spoofed' })
        .expect(400);

      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    });
  });

  describe('GET /collections', () => {
    it("only returns the caller's own collections", async () => {
      await prisma.collection.createMany({
        data: [
          { name: 'A-Recipes', ownerId: OWNER_A },
          { name: 'B-Recipes', ownerId: OWNER_B },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/collections')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ name: 'A-Recipes', ownerId: OWNER_A });
    });

    it('supports a case-insensitive partial ?name= filter', async () => {
      await prisma.collection.createMany({
        data: [
          { name: 'Cooking Recipes', ownerId: OWNER_A },
          { name: 'Travel Guides', ownerId: OWNER_A },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/collections?name=recipe')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Cooking Recipes');
    });

    it("excludes another user's collections even when ?name= matches them", async () => {
      await prisma.collection.createMany({
        data: [
          { name: 'Cooking Recipes', ownerId: OWNER_A },
          { name: 'Cooking Recipes B', ownerId: OWNER_B },
        ],
      });

      const res = await request(app.getHttpServer())
        .get('/collections?name=cooking')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ name: 'Cooking Recipes', ownerId: OWNER_A });
    });
  });

  describe('GET /collections/:id', () => {
    it('returns the collection when owned by the caller', async () => {
      const collection = await prisma.collection.create({
        data: { name: 'Mine', ownerId: OWNER_A },
      });

      const res = await request(app.getHttpServer())
        .get(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toMatchObject({ id: collection.id, name: 'Mine' });
    });

    it("returns 404 (not 403) for another user's collection", async () => {
      const collection = await prisma.collection.create({
        data: { name: "B's collection", ownerId: OWNER_B },
      });

      const res = await request(app.getHttpServer())
        .get(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(404);

      expect(res.body).toEqual({
        statusCode: 404,
        message: 'Collection not found',
        error: 'Not Found',
      });
    });

    it('returns 404 for a non-existent id', async () => {
      await request(app.getHttpServer())
        .get('/collections/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(404);
    });
  });

  describe('PUT /collections/:id', () => {
    it('updates a collection owned by the caller', async () => {
      const collection = await prisma.collection.create({
        data: { name: 'Old name', ownerId: OWNER_A },
      });

      const res = await request(app.getHttpServer())
        .put(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ name: 'New name' })
        .expect(200);

      expect(res.body.name).toBe('New name');
    });

    it("returns 404 when the collection belongs to another user", async () => {
      const collection = await prisma.collection.create({
        data: { name: "B's collection", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .put(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ name: 'Hijacked' })
        .expect(404);

      const untouched = await prisma.collection.findUnique({ where: { id: collection.id } });
      expect(untouched?.name).toBe("B's collection");
    });
  });

  describe('PATCH /collections/:id', () => {
    it('partially updates a collection owned by the caller', async () => {
      const collection = await prisma.collection.create({
        data: { name: 'Old name', ownerId: OWNER_A },
      });

      const res = await request(app.getHttpServer())
        .patch(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ name: 'Patched name' })
        .expect(200);

      expect(res.body.name).toBe('Patched name');
    });

    it("returns 404 when the collection belongs to another user", async () => {
      const collection = await prisma.collection.create({
        data: { name: "B's collection", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .patch(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .send({ name: 'Hijacked' })
        .expect(404);
    });
  });

  describe('DELETE /collections/:id', () => {
    it('deletes a collection owned by the caller and nulls out child bookmarks', async () => {
      const collection = await prisma.collection.create({
        data: { name: 'To delete', ownerId: OWNER_A },
      });
      const bookmark = await prisma.bookmark.create({
        data: {
          url: 'https://example.com',
          title: 'Example',
          ownerId: OWNER_A,
          collectionId: collection.id,
        },
      });

      await request(app.getHttpServer())
        .delete(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(204);

      const deleted = await prisma.collection.findUnique({ where: { id: collection.id } });
      expect(deleted).toBeNull();

      const orphanedBookmark = await prisma.bookmark.findUnique({ where: { id: bookmark.id } });
      expect(orphanedBookmark?.collectionId).toBeNull();
    });

    it("returns 404 when the collection belongs to another user and does not delete it", async () => {
      const collection = await prisma.collection.create({
        data: { name: "B's collection", ownerId: OWNER_B },
      });

      await request(app.getHttpServer())
        .delete(`/collections/${collection.id}`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(404);

      const stillThere = await prisma.collection.findUnique({ where: { id: collection.id } });
      expect(stillThere).not.toBeNull();
    });
  });

  describe('GET /collections/:id/bookmarks', () => {
    it("lists bookmarks within the caller's own collection", async () => {
      const collection = await prisma.collection.create({
        data: { name: 'Has bookmarks', ownerId: OWNER_A },
      });
      await prisma.bookmark.create({
        data: {
          url: 'https://example.com',
          title: 'Example',
          ownerId: OWNER_A,
          collectionId: collection.id,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/collections/${collection.id}/bookmarks`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ url: 'https://example.com', title: 'Example' });
    });

    it("returns 404 for another user's collection instead of leaking its bookmarks", async () => {
      const collection = await prisma.collection.create({
        data: { name: "B's collection", ownerId: OWNER_B },
      });
      await prisma.bookmark.create({
        data: {
          url: 'https://secret.example.com',
          title: "B's secret bookmark",
          ownerId: OWNER_B,
          collectionId: collection.id,
        },
      });

      await request(app.getHttpServer())
        .get(`/collections/${collection.id}/bookmarks`)
        .set('Authorization', `Bearer ${tokenFor(OWNER_A)}`)
        .expect(404);
    });
  });
});
