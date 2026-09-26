import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { projectRoot } from './fixture.mjs';

test('wrangler builds and checks the site before every deploy, then serves dist/', () => {
  const text = readFileSync(join(projectRoot, 'wrangler.jsonc'), 'utf8');
  const config = JSON.parse(text.split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n'));
  assert.equal(config.build.command, 'node tools/build.mjs && node tools/check.mjs');
  assert.equal(config.assets.directory, './dist');
  assert.equal(config.assets.not_found_handling, '404-page');
  assert.equal(config.main, undefined, 'assets-only: no Worker script');
  assert.equal(config.name, 'saltandlightelectrical', 'must match the Worker name in the Cloudflare dashboard');
  assert.equal(config.workers_dev, false, 'the site has one address, so deploys must not switch workers.dev back on');
});
