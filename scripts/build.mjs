/**
 * npm run build → dist/
 *   dist/server.js   the whole backend in one file (esbuild)
 *   dist/public/     the built storefront + admin (Vite)
 * Start with:  node dist/server.js
 * A few native/binary packages stay external and are installed from the root package.json.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });

console.log('\n▸ Building storefront (Vite)…');
run('npm run build', path.join(root, 'client'));

if (!fs.existsSync(path.join(root, 'server/src/generated/prisma/client.ts'))) {
  console.log('\n▸ Generating Prisma client…');
  run('npx prisma generate', path.join(root, 'server'));
}

console.log('\n▸ Bundling server (esbuild)…');
const require = createRequire(path.join(root, 'server/package.json'));
const esbuild = require('esbuild');
await esbuild.build({
  entryPoints: [path.join(root, 'server/src/index.ts')],
  outfile: path.join(root, 'dist/server.js'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  external: ['sharp', 'firebase-admin', 'firebase-admin/*', 'pdfkit', '@prisma/client', '@prisma/client/*', '@prisma/adapter-mariadb', 'mariadb'],
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
});

fs.cpSync(path.join(root, 'client/dist'), path.join(root, 'dist/public'), { recursive: true });
console.log('\n✓ Build complete → dist/server.js + dist/public  (start: node dist/server.js)\n');
