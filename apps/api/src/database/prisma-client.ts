import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../generated/prisma/client.js';

export function createPrismaClient(): PrismaClient {
  config({
    path: fileURLToPath(new URL('../../../../.env', import.meta.url)),
    quiet: true,
  });
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL es obligatoria para conectar PostgreSQL.');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
