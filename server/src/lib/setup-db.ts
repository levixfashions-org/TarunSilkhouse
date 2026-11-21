/**
 * First-start setup, so a fresh Hostinger database needs no phpMyAdmin work:
 *  1. If the tables don't exist yet, run prisma/init.sql (shipped next to the server bundle).
 *  2. If the store is brand new (no products AND no homepage blocks), load the starter catalogue.
 * Safe on every restart: once tables and content exist, it does nothing.
 * Set AUTO_SETUP=false to switch it off.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../db.ts';
import { log } from './log.ts';

let state: 'pending' | 'ready' | 'failed' = 'pending';
export const setupState = () => state;

function findInitSql(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, 'init.sql'), // dist/init.sql (production bundle)
    path.join(here, '../../prisma/init.sql'), // server/src/lib → server/prisma (dev)
    path.join(process.cwd(), 'server/prisma/init.sql'),
    path.join(process.cwd(), 'prisma/init.sql'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

async function tablesExist() {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN ('Product','HomeSection','Order','Setting')",
  );
  return Number(rows[0]?.n ?? 0) >= 4;
}

async function createTables() {
  const file = findInitSql();
  if (!file) throw new Error('init.sql not found next to the server — cannot create tables');
  const sql = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  const statements = sql
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const st of statements) {
    try {
      await prisma.$executeRawUnsafe(st);
    } catch (e) {
      const msg = String(e);
      // Re-running is harmless: ignore "already exists" / duplicate foreign keys.
      if (/already exists|Duplicate (key|foreign)|errno: 121|ER_FK_DUP_NAME|1826|1061/i.test(msg)) continue;
      throw e;
    }
  }
  log.info('db_tables_created', { statements: statements.length });
}

export async function setupDatabase() {
  if (process.env.AUTO_SETUP === 'false') {
    state = 'ready';
    return;
  }
  try {
    if (!(await tablesExist())) {
      log.info('db_setup_creating_tables');
      await createTables();
    }
    const [products, sections] = await Promise.all([prisma.product.count(), prisma.homeSection.count()]);
    if (products === 0 && sections === 0) {
      log.info('db_setup_loading_starter_store');
      const { seedDemo } = await import('./demo-seed.ts');
      await seedDemo(false);
      log.info('db_setup_starter_store_loaded');
    }
    state = 'ready';
  } catch (e) {
    state = 'failed';
    log.error('db_setup_failed', { err: String((e as Error)?.stack ?? e) });
  }
}
