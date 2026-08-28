import { createPrismaClient } from '../lib/prisma.js';
import { getDatabaseUrl } from '../lib/database-url.js';

// Safety net: this setup wipes every table. Refuse to run against anything
// that is not an explicit test database (dev.db holds real race data).
const databaseUrl = getDatabaseUrl();
if (!/[/\\]test\.db(\?|$)/.test(databaseUrl)) {
  throw new Error(
    `Tests refused: setup.js deletes all rows and DATABASE_URL does not point to a test database.\n` +
    `  Resolved URL: ${databaseUrl}\n` +
    `  Expected a path ending in test.db — run tests via "npm test", which sets DATABASE_URL="file:./test.db".`
  );
}

const prisma = createPrismaClient();

beforeAll(async () => {
  // Clean database before tests
  // Children first: several tables reference drivers, cars and tracks with
  // onDelete: Restrict, so they must go before their parents.
  await prisma.trackRecord.deleteMany();
  await prisma.controllerConfig.deleteMany();
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
  await prisma.championshipParticipant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.championship.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.car.deleteMany();
  await prisma.track.deleteMany();
  await prisma.team.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
