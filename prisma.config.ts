import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` does not need a database, so a missing URL is tolerated here.
    // Commands that do need one (migrate, seed, studio) will fail with a clear error.
    url: process.env.DATABASE_URL ?? '',
  },
});
