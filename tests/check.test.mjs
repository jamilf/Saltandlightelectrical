import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { jpegHasGps, runCheck } from '../tools/lib/check.mjs';
import { makeSite, page, post, rules } from './fixture.mjs';

const sites = [];
const fresh = () => {
  const site = makeSite();
  sites.push(site);
  return site;
};
after(() => sites.forEach((site) => site.cleanup()));

const messages = (report, kind = 'failures') => report[kind].map((item) => `[${item.rule}] ${item.where}: ${item.message}`).join('\n');
const tamper = (site, file, change) => {
  const path = join(site.dist, file);
  writeFileSync(path, change(readFileSync(path, 'utf8')));
};

test('the site as it stands passes in quiet mode', () => {
  const report = fresh().check('quiet');
  assert.deepEqual(report.failures, [], messages(report));
});

test('a planted "Get a quote" button fails rule 1', () => {
  const site = fresh();
  site.edit('src/pages/index.html', (html) => html.replace('</h1>', '</h1>\n  <p><a class="button button--primary" href="/contact/">Get a quote</a></p>'));
  const report = site.check();
  assert.ok(rules(report).includes('rule 1'), messages(report));
  assert.match(messages(report), /Offer phrase "get a quote" in page text/);
});

test('offer phrases are caught in titles, meta descriptions and alt text too', () => {
  const site = fresh();
  site.write('src/pages/plant.html', '---\ntitle: Book now\ndescription: Same day help across the west.\n---\n<div class="wrap page"><h1>Plant</h1><img src="/x.png" alt="Call us today"></div>\n');
  const text = messages(site.check());
  assert.match(text, /Offer phrase "book now" in <title>/);
  assert.match(text, /Offer phrase "same day" in <meta content>/);
  assert.match(text, /Offer phrase "call us" in <img alt>/);
});

test('phrases split across tags or with curly apostrophes are still caught', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<p>Get a <strong>quote</strong> and I’m a licensed sparky.</p>'));
  const text = messages(site.check());
  assert.match(text, /"get a quote"/);
  assert.match(text, /\[rule 2\].*Status claim "I'm a licensed"/);
});

test('status claims fail rule 2', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<p>Fully licensed and our team is ready.</p>'));
  const report = site.check();
  assert.match(messages(report), /Status claim "fully licensed"/);
  assert.match(messages(report), /Status claim "our team"/);
});

test('changing the status notice wording in a page fails, even inside the allow zone', () => {
  const site = fresh();
  const { manifest } = site.build();
  tamper(site, 'about/index.html', (html) => html.replace('isn&#39;t trading yet', 'is trading. Call now'));
  const report = runCheck({ root: site.root, manifest });
  assert.match(messages(report), /\[allow zones\] about\/index\.html: The status-notice wording doesn't match/);
  assert.doesNotMatch(messages(report), /Offer phrase "call now"/);
});

test('the allow marker on anything else fails, so it cannot become a loophole', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<div data-compliance="allow" data-allow-id="promo"><p>Get a quote</p></div>'));
  assert.match(messages(site.check()), /data-compliance is only for the status notice/);
});

test('a page without the status notice fails rule 5', () => {
  const site = fresh();
  const { manifest } = site.build();
  tamper(site, 'contact/index.html', (html) => html.replace(/<div class="status-notice"[\s\S]*?<\/div>\s*<\/div>/, ''));
  assert.match(messages(runCheck({ root: site.root, manifest })), /\[rule 5\] contact\/index\.html: The status notice is missing/);
});

test('phone links fail rule 1', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<p><a href="tel:0400000000">Ring Jamil</a></p>'));
  assert.match(messages(site.check()), /\[rule 1\].*Phone link "tel:0400000000"/);
});

test('banned JSON-LD types and properties fail rule 6', () => {
  const site = fresh();
  const ld = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Electrician","name":"x","telephone":"0400","areaServed":"Western Sydney"}</script>';
  site.write('src/pages/plant.html', page('plant', ld));
  const text = messages(site.check());
  assert.match(text, /\[rule 6\].*type "Electrician"/);
  assert.match(text, /\[rule 6\].*property "telephone"/);
  assert.match(text, /\[rule 6\].*property "areaServed"/);
});

test('microdata for a local business fails rule 6', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<div itemscope itemtype="https://schema.org/LocalBusiness"><p>Hi</p></div>'));
  assert.match(messages(site.check()), /\[rule 6\].*Microdata type LocalBusiness/);
});

test('a job title that doesn\'t match config fails rule 2', () => {
  const site = fresh();
  const { manifest } = site.build();
  tamper(site, 'about/index.html', (html) => html.replace('"name": "Jamil Flores",', '"name": "Jamil Flores",\n  "jobTitle": "Licensed electrician",'));
  assert.match(messages(runCheck({ root: site.root, manifest })), /\[rule 2\].*jobTitle is "Licensed electrician"/);
});

test('service and suburb pages fail rule 1 by their address alone', () => {
  const site = fresh();
  site.write('src/pages/services.html', page('services', '<p>Nothing to see.</p>'));
  assert.match(messages(site.check()), /\[rule 1\] services\/index\.html: The address contains "services"/);
});

test('contact reasons about quotes or jobs fail rule 1', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<form><select name="reason"><option>Following along</option><option>I need a quote</option></select></form>'));
  assert.match(messages(site.check()), /Form option "I need a quote" mentions "quote"/);
});

test('quiet mode fails if a page loses noindex or robots.txt lets crawlers in', () => {
  const site = fresh();
  const { manifest } = site.build();
  tamper(site, 'about/index.html', (html) => html.replace('<meta name="robots" content="noindex, nofollow">', ''));
  tamper(site, 'robots.txt', () => 'User-agent: *\nAllow: /\n');
  const text = messages(runCheck({ root: site.root, manifest }));
  assert.match(text, /\[quiet mode\] about\/index\.html: Missing <meta name="robots"/);
  assert.match(text, /\[quiet mode\] robots\.txt/);
});

test('a post with images must say whose photos they are (rule 8)', () => {
  const site = fresh();
  site.write('content/journal/media/board.png', 'image bytes');
  site.write('content/journal/2026-10-01-board.md', post({ body: '![A labelled switchboard](media/board.png)' }));
  assert.match(messages(site.check()), /\[rule 8\].*Add "photos: none"/);

  site.write('content/journal/2026-10-01-board.md', post({ body: '![A labelled switchboard](media/board.png)', extra: 'photos: none\n' }));
  assert.match(messages(site.check()), /\[rule 8\].*has 1 image\(s\) but says "photos: none"/);

  site.write('content/journal/2026-10-01-board.md', post({ body: '![A labelled switchboard](media/board.png)', extra: 'photos: own\n' }));
  assert.doesNotMatch(messages(site.check()), /rule 8/);
});

test('photos with GPS location data fail rule 8', () => {
  const withGps = jpegWithExif(true);
  assert.equal(jpegHasGps(withGps), true);
  assert.equal(jpegHasGps(jpegWithExif(false)), false);

  const site = fresh();
  site.write('content/journal/media/site.jpg', withGps);
  site.write('content/journal/2026-10-01-site.md', post({ body: '![Conduit run](media/site.jpg)', extra: 'photos: employer-approved\n' }));
  assert.match(messages(site.check()), /\[rule 8\] journal\/media\/site\.jpg: This photo has GPS location data/);
});

test('a compliance note turns phrase failures into warnings and prints its reason', () => {
  const site = fresh();
  site.write('content/journal/2026-10-01-words.md', post({
    body: 'An ad I saw said "call now" and it made me think about honest advertising.',
    extra: 'photos: none\ncompliance_note: Quoting an ad to explain why this site never says it.\n',
  }));
  const report = site.check();
  assert.doesNotMatch(messages(report), /call now/);
  assert.match(messages(report, 'warnings'), /Offer phrase "call now".*allowed by the post's compliance note/);
  assert.match(report.notes.map((n) => n.message).join('\n'), /Compliance note: Quoting an ad/);
});

test('How it works posts must keep the safety note', () => {
  const site = fresh();
  site.write('content/journal/2026-10-01-how.md', post({ category: 'how-it-works', extra: 'photos: none\n' }));
  const { manifest } = site.build();
  tamper(site, 'journal/how/index.html', (html) => html.replace(/<aside class="note note--safety"[\s\S]*?<\/aside>/, ''));
  assert.match(messages(runCheck({ root: site.root, manifest })), /\[rule 7\].*need the safety note/);
});

test('live mode without licence details fails rule 9 in the check too', () => {
  const site = fresh();
  site.config((config) => {
    config.site.url = 'https://example.com.au';
    config.person.email = 'jamil@example.com';
  });
  const { manifest } = site.build('prelaunch');
  const report = runCheck({ root: site.root, manifest: { ...manifest, mode: 'live' } });
  assert.match(messages(report), /\[rule 9\].*licence\.number/);
});

test('broken links and missing anchors fail', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<p><a href="/nowhere/">Nowhere</a> <a href="/about/#missing">Missing part</a> <a href="/about/#main">Main part</a></p>'));
  const text = messages(site.check());
  assert.match(text, /Broken link: \/nowhere\//);
  assert.match(text, /points at #missing/);
  assert.doesNotMatch(text, /#main/);
});

test('vague link text, missing alt text and skipped heading levels fail', () => {
  const site = fresh();
  site.write('src/pages/plant.html', page('plant', '<p><a href="/about/">Click here</a></p><img src="/x.png"><h3>Skipped</h3>'));
  const text = messages(site.check());
  assert.match(text, /Link text "Click here"/);
  assert.match(text, /Image \/x\.png has no alt attribute/);
  assert.match(text, /jumps from h1 to h3/);
});

test('placeholders are warnings in quiet mode and failures in prelaunch', () => {
  const site = fresh();
  site.edit('src/pages/about.html', (html) => html.replace('</h1>', '</h1>\n  <p>[[JAMIL: a sentence still to write]]</p>'));
  assert.ok(rules(site.check('quiet'), 'warnings').includes('placeholders'));
  site.config((config) => {
    config.site.url = 'https://example.com.au';
    config.person.email = 'jamil@example.com';
  });
  assert.ok(rules(site.check('prelaunch')).includes('placeholders'));
});

test('a finished site passes in prelaunch mode', () => {
  const site = fresh();
  site.makeReadyForPrelaunch();
  site.write('content/journal/2026-10-01-first.md', post({ extra: 'photos: none\nstage: finding-apprenticeship\n' }));
  const report = site.check('prelaunch');
  assert.deepEqual(report.failures, [], messages(report));
});

test('prelaunch fails if robots.txt still blocks everything', () => {
  const site = fresh();
  site.makeReadyForPrelaunch();
  const { manifest } = site.build('prelaunch');
  tamper(site, 'robots.txt', () => 'User-agent: *\nDisallow: /\n');
  assert.match(messages(runCheck({ root: site.root, manifest })), /\[crawlers\] robots\.txt: prelaunch mode should let search engines in/);
});

/** A minimal JPEG whose EXIF block does or doesn't point at a GPS section. */
function jpegWithExif(gps) {
  const entries = gps ? [[0x8825, 4, 1, 26]] : [[0x010f, 2, 1, 0]];
  const tiff = Buffer.alloc(8 + 2 + entries.length * 12 + 4);
  tiff.write('MM', 0, 'latin1');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(entries.length, 8);
  entries.forEach(([tag, type, count, value], index) => {
    const at = 10 + index * 12;
    tiff.writeUInt16BE(tag, at);
    tiff.writeUInt16BE(type, at + 2);
    tiff.writeUInt32BE(count, at + 4);
    tiff.writeUInt32BE(value, at + 8);
  });
  const exif = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(exif.length + 2, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, exif, Buffer.from([0xff, 0xd9])]);
}

test('words listed in the untracked private.check.json fail wherever they appear', () => {
  const site = fresh();
  site.write('private.check.json', JSON.stringify({ neverMention: ['secret project'] }));
  site.write('src/pages/plant.html', page('plant', '<p>More on the Secret Project soon.</p>'));
  const text = messages(site.check());
  assert.match(text, /\[private\] plant\/index\.html: A word from private\.check\.json appears in page text/);
  assert.doesNotMatch(text, /Secret Project/);
});

test('licensed photos need a photo credits section, and a post can list more than one source', () => {
  const site = fresh();
  site.write('content/journal/media/board.png', 'image bytes');
  const body = '![A labelled switchboard](media/board.png "A switchboard")';
  site.write('content/journal/2026-10-01-board.md', post({ body, extra: 'photos: own, licensed\n' }));
  assert.match(messages(site.check()), /\[photos\] .*uses licensed photos but has no "Photo credits" section/);

  site.write('content/journal/2026-10-01-board.md', post({ body: `${body}\n\n## Photo credits\n\n- Switchboard by Someone, CC BY 4.0.`, extra: 'photos: own, licensed\n' }));
  assert.doesNotMatch(messages(site.check()), /\[photos\]|rule 8/);

  site.write('content/journal/2026-10-01-board.md', post({ body, extra: 'photos: none, own\n' }));
  assert.throws(() => site.build(), /photos must be one of none, own, employer-approved, licensed, or a list/);
});
