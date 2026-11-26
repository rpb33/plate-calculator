import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

function offlineApp(): Plugin {
  return {
    name: 'plate-calculator-offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (!bundle['index.html']) this.error('Offline build requires index.html.');
      const template = readFileSync(new URL('./src/service-worker.js', import.meta.url), 'utf8');
      const publicFiles = [
        'manifest.webmanifest', 'favicon.svg', 'icons/apple-touch-icon.png',
        'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
      ];
      const builtFiles = Object.keys(bundle).filter((file) => !file.endsWith('.map')).sort();
      const hash = createHash('sha256').update(template);
      for (const name of builtFiles) {
        const file = bundle[name]!;
        hash.update(name).update(file.type === 'chunk' ? file.code : file.source);
      }
      for (const name of publicFiles) {
        hash.update(name).update(readFileSync(new URL(`./public/${name}`, import.meta.url)));
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__BUILD_ID__', hash.digest('hex').slice(0, 20))
          .replace('__PRECACHE_FILES__', JSON.stringify([...builtFiles, ...publicFiles])),
      });
    },
  };
}

export default defineConfig({
  // Relative URLs also scope the installed app and worker to its Pages project.
  base: './',
  plugins: [offlineApp()],
  test: { include: ['tests/**/*.test.ts'], coverage: { include: ['src/calculator.ts', 'src/inventory.ts', 'src/weight.ts'] } },
});
