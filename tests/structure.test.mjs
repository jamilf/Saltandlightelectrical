import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { findAll, parseHtml, textOf } from '../tools/lib/html.mjs';
import { makeSite, post } from './fixture.mjs';

const sites = [];
const fresh = () => {
  const site = makeSite();
  sites.push(site);
  return site;
};
after(() => sites.forEach((site) => site.cleanup()));
const read = (site, file) => readFileSync(join(site.dist, file), 'utf8');

test('the road to launch and the journal link to each other through the stage an entry was written in', () => {
  const site = fresh();
  site.write('content/journal/2026-10-01-week-one.md', post({ title: 'Week one', extra: 'stage: finding-apprenticeship\n' }));
  site.build();

  const doc = parseHtml(read(site, 'road-to-launch/index.html'));
  const note = findAll(doc, (n) => n.attrs.id === 'stage-finding-apprenticeship')[0];
  assert.ok(note, 'the S3 stage note has an anchor');
  const links = findAll(note, (n) => n.name === 'a').map((a) => a.attrs.href);
  assert.ok(links.includes('/journal/week-one/'), links.join(', '));
  const planned = findAll(doc, (n) => n.attrs.id === 'stage-apprenticeship')[0];
  assert.doesNotMatch(textOf(planned), /Written during this stage/);

  assert.match(read(site, 'journal/week-one/index.html'), /<a href="\/road-to-launch\/#stage-finding-apprenticeship">Looking for an electrical apprenticeship<\/a>/);
});

test('a stage shows its three newest entries and counts the rest', () => {
  const site = fresh();
  for (const day of ['01', '02', '03', '04', '05']) {
    site.write(`content/journal/2026-10-${day}-entry-${day}.md`, post({ title: `Entry ${day}`, date: `2026-10-${day}`, extra: 'stage: finding-apprenticeship\n' }));
  }
  site.build();
  const note = findAll(parseHtml(read(site, 'road-to-launch/index.html')), (n) => n.attrs.id === 'stage-finding-apprenticeship')[0];
  const titles = findAll(note, (n) => n.name === 'a' && n.attrs.href.startsWith('/journal/entry-')).map((a) => textOf(a));
  assert.deepEqual(titles, ['Entry 05', 'Entry 04', 'Entry 03']);
  assert.match(textOf(note), /And 3 more in the journal\./);
});

test('empty journal categories stay out of search results and the sitemap until their first entry', () => {
  const site = fresh();
  site.makeReadyForPrelaunch();
  site.build('prelaunch');
  const sitemap = read(site, 'sitemap.xml');
  assert.doesNotMatch(sitemap, /tools-and-kit/);
  assert.match(sitemap, /journal\/building-the-business\//);
  assert.match(read(site, 'journal/tools-and-kit/index.html'), /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(read(site, 'journal/building-the-business/index.html'), /name="robots"/);
  assert.match(read(site, 'journal/tools-and-kit/index.html'), /No entries here yet\. Until there are, <a href="\/journal\/">read all entries<\/a>/);

  site.write('content/journal/2026-10-01-my-first-multimeter.md', post({ title: 'My first multimeter', category: 'tools-and-kit' }));
  site.build('prelaunch');
  assert.match(read(site, 'sitemap.xml'), /journal\/tools-and-kit\//);
});

test('a post can never take over a category page address', () => {
  const site = fresh();
  site.write('content/journal/2026-10-01-tools-and-kit.md', post({ title: 'Tools and kit' }));
  assert.throws(() => site.build(), /taken by the Tools and kit category page/);
});

test('titles drop the site name when it would push them past 60 characters', () => {
  const site = fresh();
  site.build();
  const title = (file) => textOf(findAll(parseHtml(read(site, file)), (n) => n.name === 'title')[0]);
  assert.equal(title('about/index.html'), 'About | Salt and Light Electrical');
  assert.equal(title('journal/why-im-building-early/index.html'), "Why I'm building a business six years early");
});

test('llms.txt lists the journal entries alongside the main pages', () => {
  const site = fresh();
  site.build();
  const llms = read(site, 'llms.txt');
  assert.match(llms, /## Journal\n\n- \[Why I'm building a business six years early\]\(https:\/\/saltandlightelectrical\.com\/journal\/why-im-building-early\/\), 2026-09-26: /);
});
