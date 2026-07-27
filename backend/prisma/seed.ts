import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Real Auth0 test account (candidate@test.com) - sub verified stable
// across 3 separate logins, see DECISIONS.md "Verifying sub claim
// stability".
const REAL_OWNER = 'auth0|62e089faea483987422db6cc';

// Synthetic second user - not tied to a real Auth0 login, per
// DECISIONS.md "Seed data for 2 users". The Auth0 test tenant only
// provides one login-capable account, so this exists purely to prove
// the privacy invariant: this user's data must never be visible to
// REAL_OWNER, and vice versa.
const SYNTHETIC_OWNER = 'auth0|synthetic-seed-user-b';

async function seed() {
  // Scoped to just these two owners so re-running this script is safe
  // and idempotent - it never touches any other data in the database.
  await prisma.bookmark.deleteMany({
    where: { ownerId: { in: [REAL_OWNER, SYNTHETIC_OWNER] } },
  });
  await prisma.collection.deleteMany({
    where: { ownerId: { in: [REAL_OWNER, SYNTHETIC_OWNER] } },
  });

  const readingList = await prisma.collection.create({
    data: { name: 'Reading List', ownerId: REAL_OWNER },
  });
  const recipes = await prisma.collection.create({
    data: { name: 'Recipes', ownerId: REAL_OWNER },
  });

  await prisma.bookmark.createMany({
    data: [
      {
        url: 'https://en.wikipedia.org/wiki/Web_development',
        title: 'Web development',
        ownerId: REAL_OWNER,
        collectionId: readingList.id,
      },
      {
        url: 'https://www.bbcgoodfood.com',
        title: 'BBC Good Food',
        ownerId: REAL_OWNER,
        collectionId: recipes.id,
      },
      {
        url: 'https://news.ycombinator.com',
        title: 'Hacker News',
        notes: 'Uncategorised bookmark',
        ownerId: REAL_OWNER,
      },
    ],
  });

  const work = await prisma.collection.create({
    data: { name: 'Work', ownerId: SYNTHETIC_OWNER },
  });

  await prisma.bookmark.createMany({
    data: [
      {
        url: 'https://nestjs.com',
        title: 'NestJS Docs',
        ownerId: SYNTHETIC_OWNER,
        collectionId: work.id,
      },
      {
        url: 'https://www.postgresql.org',
        title: 'PostgreSQL',
        notes: 'Uncategorised bookmark',
        ownerId: SYNTHETIC_OWNER,
      },
    ],
  });

  console.log('Seeded:');
  console.log(`  ${REAL_OWNER}: 2 collections, 3 bookmarks`);
  console.log(`  ${SYNTHETIC_OWNER}: 1 collection, 2 bookmarks`);
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
