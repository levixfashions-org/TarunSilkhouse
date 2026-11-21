/** npm run seed — loads the starter store (12 sarees, collections, homepage, pages). SEED_FORCE=1 wipes the catalogue first. */
import { prisma } from '../src/db.ts';
import { seedDemo } from '../src/lib/demo-seed.ts';

seedDemo()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
