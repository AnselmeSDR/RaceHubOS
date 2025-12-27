import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Clean database before tests
  await prisma.lap.deleteMany();
  await prisma.sessionDriver.deleteMany();
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
