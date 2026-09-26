// Build the site: node tools/build.mjs [--mode quiet|prelaunch|live]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { build } from './lib/build.mjs';
import { SiteError } from './lib/util.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { mode: { type: 'string' } } });

try {
  const { manifest } = build({ root, mode: values.mode });
  mkdirSync(join(root, '.build'), { recursive: true });
  writeFileSync(join(root, '.build', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Built ${manifest.pages.length} pages in ${manifest.mode} mode into dist/.`);
  for (const draft of manifest.drafts) console.log(`  Draft, not built: ${draft.file}`);
} catch (error) {
  if (error instanceof SiteError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
