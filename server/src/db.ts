import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/prisma/client.ts';
import { env } from './env.ts';

function adapterFromUrl(url: string) {
  const u = new URL(url);
  return new PrismaMariaDb({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    connectionLimit: 10,
    // MySQL 8 on Hostinger uses caching_sha2_password; allow RSA key fetch over non-TLS local socket.
    allowPublicKeyRetrieval: true,
  });
}

export const prisma = new PrismaClient({ adapter: adapterFromUrl(env.DATABASE_URL) });
export type DB = typeof prisma;
export { Prisma } from './generated/prisma/client.ts';
