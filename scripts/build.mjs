// Builds everything with esbuild:
//   dist/embed/orb.js            the orb for any page (IIFE, global OrbEmbed)
//   dist/browser/main.cjs        the Orb Browser's main process
//   dist/browser/page-preload.cjs  the orb inside every page the browser shows
//   dist/browser/chrome-preload.cjs, dist/browser/chrome/*  the browser's own top bar
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

const common = {
  bundle: true,
  logLevel: 'warning',
  sourcemap: 'linked',
  target: 'es2022',
  jsx: 'automatic',
  loader: { '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
};

await Promise.all([
  build({ ...common, entryPoints: ['src/embed/index.ts'], outfile: 'dist/embed/orb.js', format: 'iife', globalName: 'OrbEmbed', platform: 'browser', minify: true }),
  build({ ...common, entryPoints: ['browser/main.ts'], outfile: 'dist/browser/main.cjs', format: 'cjs', platform: 'node', external: ['electron'], define: {} }),
  build({ ...common, entryPoints: ['browser/page-preload.ts'], outfile: 'dist/browser/page-preload.cjs', format: 'cjs', platform: 'browser', external: ['electron'], minify: true }),
  build({ ...common, entryPoints: ['browser/chrome-preload.ts'], outfile: 'dist/browser/chrome-preload.cjs', format: 'cjs', platform: 'browser', external: ['electron'] }),
  build({
    ...common,
    entryPoints: ['browser/chrome/chrome.tsx'],
    outdir: 'dist/browser/chrome',
    format: 'iife',
    platform: 'browser',
    minify: true,
    // The chrome's own stylesheet (and the fonts it pulls in) is a real CSS file, not text.
    loader: { '.woff2': 'file', '.woff': 'file' },
    assetNames: 'fonts/[name]-[hash]',
  }),
]);
mkdirSync('dist/browser/chrome', { recursive: true });
cpSync('browser/chrome/index.html', 'dist/browser/chrome/index.html');
console.log('built dist/');
