import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { walkFiles } from '../tools/lib/util.mjs';
import { makeSite, post } from './fixture.mjs';

const sites = [];
const fresh = () => {
  const site = makeSite();
  sites.push(site);
  return site;
};
after(() => sites.forEach((site) => site.cleanup()));

const snapshot = (dir) =>
  Object.fromEntries(walkFiles(dir).map((file) => [file, createHash('sha256').update(readFileSync(join(dir, file))).digest('hex')]));

test('the build is idempotent: two builds give identical files', () => {
  const site = fresh();
  site.build();
  const first = snapshot(site.dist);
  site.build();
  assert.deepEqual(snapshot(site.dist), first);
});

test('quiet mode hides the site from search engines', () => {
  const site = fresh();
  const { manifest } = site.build('quiet');
  for (const page of manifest.pages) {
    const html = readFileSync(join(site.dist, page.file), 'utf8');
    assert.match(html, /<meta name="robots" content="noindex, nofollow">/, page.file);
  }
  assert.equal(readFileSync(join(site.dist, 'robots.txt'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#')).join('|'), 'User-agent: *|Disallow: /');
  assert.equal(existsSync(join(site.dist, 'sitemap.xml')), false);
  assert.match(readFileSync(join(site.dist, '_headers'), 'utf8'), /X-Robots-Tag: noindex, nofollow/);
});

test('every page carries the status notice with the wording from config', () => {
  const site = fresh();
  const { manifest } = site.build();
  const notice = "Salt and Light Electrical isn&#39;t trading yet. Jamil Flores is looking for an electrical apprenticeship and doesn&#39;t offer electrical services or hold an electrical contractor licence.";
  for (const page of manifest.pages) {
    assert.ok(readFileSync(join(site.dist, page.file), 'utf8').includes(notice), page.file);
  }
});

test('prelaunch mode needs a site address, then opens up to crawlers', () => {
  const site = fresh();
  site.config((config) => {
    config.site.url = null;
  });
  assert.throws(() => site.build('prelaunch'), /site\.url must be set before prelaunch/);
  site.config((config) => {
    config.site.url = 'https://example.com.au/';
    config.person.email = 'jamil@example.com';
  });
  const { manifest } = site.build('prelaunch');
  const robots = readFileSync(join(site.dist, 'robots.txt'), 'utf8');
  for (const bot of ['Googlebot', 'Bingbot', 'ClaudeBot', 'GPTBot', 'PerplexityBot']) assert.match(robots, new RegExp(`User-agent: ${bot}`));
  assert.match(robots, /Sitemap: https:\/\/example\.com\.au\/sitemap\.xml/);
  const sitemap = readFileSync(join(site.dist, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/example\.com\.au\/road-to-launch\/<\/loc>/);
  assert.doesNotMatch(sitemap, /following|404/);
  const home = readFileSync(join(site.dist, 'index.html'), 'utf8');
  assert.doesNotMatch(home, /name="robots"/);
  assert.match(home, /<link rel="canonical" href="https:\/\/example\.com\.au\/">/);
  assert.ok(manifest.pages.find((p) => p.path === '/following/').noindex);
});

test('live mode refuses to build without the licence details (rule 9)', () => {
  const site = fresh();
  site.config((config) => {
    config.site.url = 'https://example.com.au';
    config.person.email = 'jamil@example.com';
  });
  assert.throws(() => site.build('live'), (error) => {
    assert.match(error.message, /licence\.holderName or licence\.businessName/);
    assert.match(error.message, /licence\.number/);
    assert.match(error.message, /licence\.phone/);
    return true;
  });
});

test('live mode with licence details shows them on every page', () => {
  const site = fresh();
  site.config((config) => {
    config.site.url = 'https://example.com.au';
    config.person.email = 'jamil@example.com';
    config.licence = { holderName: 'Test Holder', businessName: null, number: '123456C', phone: '02 0000 0000' };
  });
  site.edit('content/milestones.json', (text) => text.replace('"status": "current"', '"status": "done"'));
  const { manifest } = site.build('live');
  for (const page of manifest.pages) {
    assert.match(readFileSync(join(site.dist, page.file), 'utf8'), /Test Holder\. Electrical contractor licence number 123456C\. Phone 02 0000 0000\./, page.file);
  }
});

test('drafts never build, and posts get their metadata', () => {
  const site = fresh();
  site.write('content/journal/2026-10-01-first-week.md', post({ title: 'First week', extra: 'photos: none\nstage: finding-apprenticeship\n' }));
  site.write('content/journal/2026-10-08-how-rcds-work.md', post({ title: 'How safety switches work', date: '2026-10-08', category: 'how-it-works', extra: 'photos: none\n' }));
  site.write('content/journal/2026-10-09-unfinished.md', post({ title: 'Unfinished', date: '2026-10-09', extra: 'draft: true\n' }));
  site.write('content/journal/_template.md', post({ title: 'Template' }));
  const { manifest } = site.build();

  assert.ok(manifest.drafts.map((d) => d.slug).includes('unfinished'));
  assert.ok(!manifest.pages.some((p) => p.path === '/journal/first-apprentice-log/'));
  assert.equal(existsSync(join(site.dist, 'journal/unfinished')), false);
  assert.equal(existsSync(join(site.dist, 'journal/template')), false);

  const first = readFileSync(join(site.dist, 'journal/first-week/index.html'), 'utf8');
  assert.match(first, /<dt>Written during<\/dt><dd><a href="\/road-to-launch\/#stage-finding-apprenticeship">Looking for an electrical apprenticeship<\/a><\/dd>/);
  assert.match(first, /<dt>Reading time<\/dt><dd>1 minute<\/dd>/);
  assert.match(first, /Next entry: <a href="\/journal\/how-rcds-work\/">How safety switches work<\/a>/);
  assert.doesNotMatch(first, /data-allow-id="safety-note"/);
  assert.match(first, /"@type": "BlogPosting"/);

  const how = readFileSync(join(site.dist, 'journal/how-rcds-work/index.html'), 'utf8');
  assert.match(how, /data-allow-id="safety-note"/);
  assert.match(how, /General information only\. In NSW, electrical work must be done by a licensed electrician\. Don&#39;t attempt it yourself\./);

  const category = readFileSync(join(site.dist, 'journal/how-it-works/index.html'), 'utf8');
  assert.match(category, /How safety switches work/);
  assert.doesNotMatch(category, /First week/);

  const rss = readFileSync(join(site.dist, 'rss.xml'), 'utf8');
  assert.match(rss, /<title>How safety switches work<\/title>/);
  assert.doesNotMatch(rss, /Unfinished/);
});

test('journal problems stop the build with a clear message', () => {
  const site = fresh();
  site.write('content/journal/2026-10-01-bad.md', post({ category: 'services' }));
  assert.throws(() => site.build(), /category must be one of apprentice-log/);
});

test('milestones must have exactly one current stage, in order', () => {
  const site = fresh();
  site.edit('content/milestones.json', (text) => text.replace('"status": "planned"', '"status": "current"'));
  assert.throws(() => site.build(), /Exactly one stage must be current \(found 2\)/);
});

test('revision letter and last updated date come from the newest revision', () => {
  const site = fresh();
  site.edit('content/milestones.json', (text) =>
    text.replace('"revisions": [', '"revisions": [\n    { "rev": "B", "date": "2026-12-01", "note": "Second issue." },'),
  );
  site.build();
  assert.match(readFileSync(join(site.dist, 'index.html'), 'utf8'), /<a href="\/road-to-launch\/#revision-history">Revision B<\/a>, updated 1 December 2026\./);
});
