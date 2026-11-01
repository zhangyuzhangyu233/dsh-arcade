// Bundle src/client.js into the browser bundle the host serves at /plugins.
// Resolves esbuild from this package's node_modules (or $ESBUILD); a local art
// checkout fallback keeps the author's machine working without npm install.
//
//   node tools/build.mjs             production build
//   node tools/build.mjs --selftest  diagnostic build that drives one
//                                    end-to-end self test in the open GUI
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, utimesSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

function localEsbuild() {
  try {
    return join(dirname(require.resolve('esbuild/package.json')), 'bin', 'esbuild');
  } catch {
    return null;
  }
}

const SELF_TEST = process.argv.includes('--selftest');

const CANDIDATES = [
  process.env.ESBUILD,
  localEsbuild(),
  'C:/Users/zy134/Desktop/dsh-claudelike/code-ripple-background/node_modules/esbuild/bin/esbuild',
];

const esbuild = CANDIDATES.find((candidate) => candidate && existsSync(candidate));
if (!esbuild) {
  console.error('esbuild not found; set ESBUILD to node_modules/esbuild/bin/esbuild');
  process.exit(1);
}

// Regenerate the themed power-up data URIs first (tiny, no dependencies).
// Regenerate the inline shooter SVG / themed enemy art first.
const shooter = spawnSync(process.execPath, ['tools/build-shooter.mjs'], { stdio: 'inherit' });
if (shooter.status !== 0) process.exit(shooter.status ?? 1);

const powerups = spawnSync(process.execPath, ['tools/build-powerups.mjs'], { stdio: 'inherit' });
if (powerups.status !== 0) process.exit(powerups.status ?? 1);

const result = spawnSync(process.execPath, [
  esbuild,
  'src/client.js',
  '--bundle',
  '--format=iife',
  '--platform=browser',
  '--target=es2022',
  '--legal-comments=none',
  `--define:__SELF_TEST__=${SELF_TEST}`,
  '--outfile=client.js',
  '--log-level=info',
], { stdio: 'inherit' });

if (result.status !== 0) process.exit(result.status ?? 1);

// Stamp the artifact so the client-hmr poll notices the rebuild.
const now = new Date();
utimesSync('client.js', now, now);

// The offline preview harness is bundled separately (it talks to no host).
const preview = spawnSync(process.execPath, [
  esbuild,
  'src/preview.js',
  '--bundle',
  '--format=iife',
  '--platform=browser',
  '--target=es2022',
  '--legal-comments=none',
  '--outfile=preview/bundle.js',
  '--log-level=warning',
], { stdio: 'inherit' });
if (preview.status !== 0) process.exit(preview.status ?? 1);

const size = statSync('client.js').size;
const previewSize = statSync('preview/bundle.js').size;
console.log(`client.js rebuilt (${(size / 1024).toFixed(1)} KiB)${SELF_TEST ? ' [selftest]' : ''}`);
console.log(`preview/bundle.js rebuilt (${(previewSize / 1024).toFixed(1)} KiB)`);
