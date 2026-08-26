import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { getDatabaseUrl } from './src/lib/database-url.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
