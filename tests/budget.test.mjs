import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { byName, parseHtml } from '../tools/lib/html.mjs';
import { makeSite } from './fixture.mjs';

const site = makeSite();
after(() => site.cleanup());

test('JavaScript stays under 10 KB and the home page under 300 KB on first load', () => {
  site.config((config) => {
    config.forms.newsletter.endpoint = 'https://forms.example.com/newsletter';
  });
  site.build();
  const size = (path) => statSync(join(site.dist, path.split('?')[0].replace(/^\//, ''))).size;

  const js = size('/assets/js/site.js');
  assert.ok(js < 10 * 1024, `site.js is ${js} bytes`);

  const home = readFileSync(join(site.dist, 'index.html'), 'utf8');
  const doc = parseHtml(home);
  const assets = [
    ...byName(doc, 'link').filter((l) => ['stylesheet', 'icon', 'preload'].includes(l.attrs.rel)).map((l) => l.attrs.href),
    ...byName(doc, 'script').filter((s) => s.attrs.src).map((s) => s.attrs.src),
    ...byName(doc, 'img').map((i) => i.attrs.src),
    '/assets/fonts/poppins-500.woff2',
    '/assets/fonts/poppins-600.woff2',
  ];
  const total = Buffer.byteLength(home) + [...new Set(assets)].reduce((sum, path) => sum + size(path), 0);
  assert.ok(total < 300 * 1024, `home page first load is ${total} bytes`);
});

test('no third-party scripts unless analytics is switched on', () => {
  const home = readFileSync(join(site.dist, 'index.html'), 'utf8');
  const external = byName(parseHtml(home), 'script').filter((s) => /^https?:/.test(s.attrs.src ?? ''));
  assert.deepEqual(external, []);
});
