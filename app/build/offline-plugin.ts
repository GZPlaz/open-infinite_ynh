/**
 * Build-time extras for low-power, offline-friendly hosting:
 *  - emits sw.js with a precache list of the hashed assets;
 *  - writes .gz siblings next to compressible assets so nginx can serve them
 *    with `gzip_static on` instead of compressing on every request.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Plugin } from 'vite';

const COMPRESSIBLE = /\.(js|mjs|css|svg|json|webmanifest|ttf|txt|map)$/;
const PRECACHE_SKIP = /\.(woff|ttf|map|gz)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function offline(): Plugin {
  let outDir = 'dist';
  return {
    name: 'openinfinite-offline',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir).map((f) => relative(outDir, f).split('\\').join('/'));
      const precache = ['./', ...files.filter((f) => f !== 'index.html' && f !== 'sw.js' && !PRECACHE_SKIP.test(f)).sort()];
      const version = createHash('sha256')
        .update(precache.map((f) => (f === './' ? readFileSync(join(outDir, 'index.html')) : readFileSync(join(outDir, f)))).reduce((a, b) => Buffer.concat([a, b]), Buffer.alloc(0)))
        .digest('hex')
        .slice(0, 12);
      const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
      writeFileSync(join(outDir, 'sw.js'), template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache, null, 2)));
      for (const f of files) {
        if (!f.startsWith('assets/') || !COMPRESSIBLE.test(f)) continue;
        const p = join(outDir, f);
        const data = readFileSync(p);
        if (data.length < 1024) continue;
        writeFileSync(`${p}.gz`, gzipSync(data, { level: 9 }));
      }
    },
  };
}
