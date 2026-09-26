// The compliance, metadata and link check. Reads what the build wrote to dist/ and reports:
//   failures  - stop the deploy
//   warnings  - worth fixing, don't stop anything
//   notes     - things you asked to keep seeing, like compliance notes on posts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allowedZoneTexts, liveProblems, loadConfig } from './config.mjs';
import { byName, findAll, parseHtml, textOf, walk } from './html.mjs';
import { PLACEHOLDER_PATTERN, SiteError, normalizeText, walkFiles } from './util.mjs';

const TEXT_ATTRIBUTES = ['alt', 'title', 'aria-label', 'placeholder', 'value', 'content', 'label'];
const PHONE_SCHEMES = /^\s*(tel|sms|callto):/i;

class Report {
  constructor() {
    this.failures = [];
    this.warnings = [];
    this.notes = [];
  }
  fail(rule, where, message) {
    this.failures.push({ rule, where, message });
  }
  warn(rule, where, message) {
    this.warnings.push({ rule, where, message });
  }
  note(where, message) {
    this.notes.push({ where, message });
  }
}

/**
 * @param {{ root: string, distDir?: string, manifest?: object }} options
 */
export function runCheck({ root, distDir = join(root, 'dist'), manifest }) {
  const report = new Report();

  if (!manifest) {
    const manifestPath = join(root, '.build', 'manifest.json');
    if (!existsSync(manifestPath) || !existsSync(distDir)) {
      report.fail('setup', 'dist/', 'Nothing to check. Run node tools/build.mjs first.');
      return report;
    }
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  }

  let config;
  try {
    config = loadConfig(root, { mode: manifest.mode, liveGuard: false });
  } catch (error) {
    if (!(error instanceof SiteError)) throw error;
    for (const problem of error.problems) report.fail('config', 'site.config.json', problem);
    return report;
  }

  const mode = config.mode;
  report.mode = mode;
  const prelive = mode !== 'live';
  const complete = mode !== 'quiet';

  // Rule 9. Live mode stays off until the licence details are real.
  if (mode === 'live') {
    for (const problem of liveProblems(config)) report.fail('rule 9', 'site.config.json', problem);
  }

  const files = walkFiles(distDir);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));
  const expectedZones = allowedZoneTexts(config);
  const offerPatterns = config.compliance.offerPhrases.map((phrase) => [phrase, phrasePattern(phrase)]);
  const claimPatterns = config.compliance.statusClaims.map((phrase) => [phrase, phrasePattern(phrase)]);
  const postsByFile = new Map((manifest.posts ?? []).map((post) => [fileForUrl(post.url), post]));

  // Optional, never committed: private.check.json lists words that must never appear on the site.
  const privatePath = join(root, 'private.check.json');
  const privatePatterns = existsSync(privatePath)
    ? (JSON.parse(readFileSync(privatePath, 'utf8')).neverMention ?? []).map((phrase) => [phrase, phrasePattern(phrase)])
    : [];

  // Compliance notes print on every run, so they never get forgotten.
  for (const post of manifest.posts ?? []) {
    if (post.complianceNote) report.note(post.file, `Compliance note: ${post.complianceNote}`);
  }

  // Rule 1. No service or suburb pages, whatever they're called.
  if (prelive) {
    const banned = new Set(config.compliance.bannedPathSegments.map((segment) => segment.toLowerCase()));
    for (const file of files) {
      const segments = file.toLowerCase().replace(/\.[a-z0-9]+$/, '').split('/');
      const hit = segments.find((segment) => banned.has(segment));
      if (hit) report.fail('rule 1', file, `The address contains "${hit}". Service, booking and suburb pages wait for live mode.`);
    }
  }

  const pages = new Map();
  for (const file of htmlFiles) {
    const source = readFileSync(join(distDir, file), 'utf8');
    pages.set(file, { source, doc: parseHtml(source) });
  }

  const titles = new Map();
  const descriptions = new Map();

  for (const [file, { doc }] of pages) {
    const post = postsByFile.get(file);
    const phraseRule = (rule, where, message) => {
      if (post?.complianceNote) report.warn(rule, where, `${message} (allowed by the post's compliance note)`);
      else report.fail(rule, where, message);
    };

    const body = byName(doc, 'body')[0] ?? doc;
    const isAllowZone = (node) => node.attrs?.['data-compliance'] !== undefined;

    // Allow zones: only the three known notices, with the wording from site.config.json.
    const zones = findAll(doc, isAllowZone);
    for (const zone of zones) {
      const id = zone.attrs['data-allow-id'];
      if (zone.attrs['data-compliance'] !== 'allow' || !Object.prototype.hasOwnProperty.call(expectedZones, id)) {
        report.fail('allow zones', file, `data-compliance is only for the status notice, safety note and contact disclaimer. Remove it from <${zone.name}${id ? ` data-allow-id="${id}"` : ''}>.`);
        continue;
      }
      if (normalizeText(textOf(zone)) !== normalizeText(expectedZones[id])) {
        report.fail('allow zones', file, `The ${id} wording doesn't match site.config.json. Change it there, not in the page.`);
      }
    }

    // Rule 5. The status notice is on every page (in live mode it carries the licence details, rule 9).
    const notices = zones.filter((zone) => zone.attrs['data-allow-id'] === 'status-notice');
    if (notices.length !== 1) {
      report.fail(mode === 'live' ? 'rule 9' : 'rule 5', file, notices.length ? 'The status notice appears more than once.' : 'The status notice is missing. Every page needs {{> status-notice }}.');
    }

    // Everything a visitor, a search result or a link preview can show, minus the allow zones.
    const segments = [{ where: 'page text', text: textOf(body, (node) => isAllowZone(node)) }];
    const title = byName(doc, 'title')[0];
    if (title) segments.push({ where: '<title>', text: textOf(title) });
    walk(doc, (node) => {
      if (node.type !== 'element') return;
      for (const attr of TEXT_ATTRIBUTES) {
        if (node.attrs[attr]) segments.push({ where: `<${node.name} ${attr}>`, text: node.attrs[attr] });
      }
    });

    // Rule 6. Structured data: allowed types only, no service or rating properties.
    for (const script of byName(doc, 'script').filter((s) => (s.attrs.type ?? '').toLowerCase() === 'application/ld+json')) {
      let data;
      try {
        data = JSON.parse(script.children.map((child) => child.value).join(''));
      } catch {
        report.fail('rule 6', file, 'A JSON-LD block isn\'t valid JSON.');
        continue;
      }
      const strings = [];
      inspectJsonLd(data, config, (message) => (prelive ? report.fail('rule 6', file, message) : report.warn('rule 6', file, message)), strings);
      segments.push(...strings.map((text) => ({ where: 'JSON-LD', text })));
      for (const person of findPeople(data)) {
        const expected = config.person.jobTitle ?? undefined;
        if (person.name === config.person.name && person.jobTitle !== expected) {
          report.fail('rule 2', file, `Person jobTitle is "${person.jobTitle}" but site.config.json says "${expected ?? 'none'}".`);
        }
      }
    }
    for (const node of findAll(doc, (n) => n.attrs.itemtype || n.attrs.typeof || n.attrs.itemprop)) {
      const types = `${node.attrs.itemtype ?? ''} ${node.attrs.typeof ?? ''}`.split(/\s+/).filter(Boolean).map((t) => t.split('/').pop());
      const bad = types.filter((type) => !config.compliance.allowedSchemaTypes.includes(type));
      if (bad.length && prelive) report.fail('rule 6', file, `Microdata type ${bad.join(', ')} isn't allowed before live mode.`);
      if (node.attrs.itemprop && config.compliance.bannedSchemaProperties.includes(node.attrs.itemprop) && prelive) {
        report.fail('rule 6', file, `Microdata property ${node.attrs.itemprop} isn't allowed before live mode.`);
      }
    }

    // Rules 1 and 2. Offer phrases and status claims.
    if (prelive) {
      for (const segment of segments) {
        for (const [phrase, pattern] of offerPatterns) {
          const hit = findPhrase(segment.text, pattern);
          if (hit) phraseRule('rule 1', file, `Offer phrase "${phrase}" in ${segment.where}: "${hit}"`);
        }
        for (const [phrase, pattern] of claimPatterns) {
          const hit = findPhrase(segment.text, pattern);
          if (hit) phraseRule('rule 2', file, `Status claim "${phrase}" in ${segment.where}: "${hit}"`);
        }
      }
      // No reason on a form can be about quotes, jobs or prices.
      for (const option of byName(doc, 'option')) {
        const text = textOf(option);
        const term = config.compliance.contactOptionTerms.find((word) => phrasePattern(word).test(normalizeText(text)));
        if (term) report.fail('rule 1', file, `Form option "${text}" mentions "${term}". Reasons to get in touch can't be about work.`);
      }
    }

    for (const segment of segments) {
      for (const [phrase, pattern] of privatePatterns) {
        if (findPhrase(segment.text, pattern)) report.fail('private', file, `A word from private.check.json appears in ${segment.where}.`);
      }
    }

    // Quiet mode: every page tells search engines to stay away.
    const robots = findAll(doc, (n) => n.name === 'meta' && (n.attrs.name ?? '').toLowerCase() === 'robots')[0];
    if (mode === 'quiet') {
      const content = (robots?.attrs.content ?? '').toLowerCase();
      if (!content.includes('noindex') || !content.includes('nofollow')) {
        report.fail('quiet mode', file, 'Missing <meta name="robots" content="noindex, nofollow">.');
      }
    }

    // Metadata.
    const html = byName(doc, 'html')[0];
    if (!html?.attrs.lang) report.fail('metadata', file, 'The <html> element needs a lang attribute.');
    const titleText = title ? normalizeText(textOf(title)) : '';
    if (!titleText) report.fail('metadata', file, 'The page has no <title>.');
    else titles.set(titleText, [...(titles.get(titleText) ?? []), file]);

    const meta = (key, value) => findAll(doc, (n) => n.name === 'meta' && (n.attrs[key] ?? '').toLowerCase() === value)[0]?.attrs.content;
    const description = meta('name', 'description');
    if (!description) report.fail('metadata', file, 'The page has no meta description.');
    else {
      descriptions.set(description, [...(descriptions.get(description) ?? []), file]);
      if (description.length > 170) report.warn('metadata', file, `The meta description is ${description.length} characters. Search results cut off around 160.`);
    }
    if (titleText.length > 70) report.warn('metadata', file, `The title is ${titleText.length} characters. Search results cut off around 60.`);

    for (const property of ['og:title', 'og:description', 'og:url', 'og:type', 'og:site_name']) {
      if (!meta('property', property)) report.fail('metadata', file, `Missing <meta property="${property}">.`);
    }
    if (!meta('name', 'twitter:card')) report.fail('metadata', file, 'Missing <meta name="twitter:card">.');
    if (!meta('property', 'og:image')) {
      const message = 'No Open Graph image yet, so link previews will be plain. Set site.ogImage.';
      if (complete) report.fail('metadata', file, message);
      else if (file === 'index.html') report.warn('metadata', file, message);
    }

    const canonical = findAll(doc, (n) => n.name === 'link' && (n.attrs.rel ?? '').toLowerCase() === 'canonical')[0];
    if (file !== '404.html') {
      const expected = `${config.origin}${urlForFile(file)}`;
      if (!canonical) report.fail('metadata', file, 'Missing <link rel="canonical">.');
      else if (canonical.attrs.href !== expected) report.fail('metadata', file, `Canonical is ${canonical.attrs.href}, expected ${expected}.`);
    }

    const headings = findAll(body, (n) => /^h[1-6]$/.test(n.name));
    const h1s = headings.filter((h) => h.name === 'h1');
    if (h1s.length !== 1) report.fail('metadata', file, `Pages need exactly one <h1> (found ${h1s.length}).`);
    let previous = 0;
    for (const heading of headings) {
      const level = Number(heading.name[1]);
      if (previous && level > previous + 1) {
        report.fail('metadata', file, `Heading "${textOf(heading)}" jumps from h${previous} to h${level}.`);
      }
      previous = level;
    }

    for (const img of byName(doc, 'img')) {
      if (img.attrs.alt === undefined) report.fail('metadata', file, `Image ${img.attrs.src} has no alt attribute. Describe it, or use alt="" if it's decoration.`);
    }

    const vague = new Set(config.style.vagueLinkText.map((text) => text.toLowerCase()));
    for (const a of byName(body, 'a')) {
      const label = normalizeText(a.attrs['aria-label'] ?? (textOf(a) || byName(a, 'img').map((img) => img.attrs.alt ?? '').join(' ')));
      if (!label) report.fail('metadata', file, `A link to ${a.attrs.href ?? '(no href)'} has no text.`);
      else if (vague.has(label.toLowerCase().replace(/[.:]+$/, ''))) {
        report.fail('metadata', file, `Link text "${label}" doesn't say where it goes.`);
      }
    }

    if (findAll(doc, (n) => n.attrs.style !== undefined).length) {
      report.warn('metadata', file, 'An inline style attribute will be blocked by the content security policy. Use a class.');
    }

    // Style: warnings only.
    const prose = textOf(body, (node) => node.name === 'code' || node.name === 'pre');
    if (prose.includes('\u2014')) report.warn('style', file, 'Contains an em dash. Use a comma, a full stop or brackets.');
    const bang = prose.match(/[^\s]{0,30}!(?=\s|$)/);
    if (bang) report.warn('style', file, `Contains an exclamation mark: "${bang[0]}"`);
    for (const word of config.style.bannedWords) {
      const hit = findPhrase(prose, phrasePattern(word));
      if (hit) report.warn('style', file, `Avoid "${word}": "${hit}"`);
    }
    const proper = new Set(config.style.properNouns);
    for (const heading of headings) {
      const words = normalizeText(textOf(heading)).split(' ').slice(1);
      const capitalised = words.filter((word) => /^[A-Z]/.test(word) && !proper.has(word.replace(/[^\w']/g, '')));
      if (capitalised.length >= 2) report.warn('style', file, `Heading "${textOf(heading)}" looks like title case. Use sentence case.`);
    }

    // Journal posts.
    if (post?.safetyNote && !zones.some((zone) => zone.attrs['data-allow-id'] === 'safety-note')) {
      report.fail('rule 7', file, 'How it works posts need the safety note.');
    }
  }

  for (const [title, where] of titles) {
    if (where.length > 1) report.fail('metadata', where.join(', '), `Pages share the title "${title}".`);
  }
  for (const [description, where] of descriptions) {
    if (where.length > 1) report.fail('metadata', where.join(', '), `Pages share the description "${description.slice(0, 60)}...".`);
  }

  checkLinks({ pages, files, config, report, prelive });
  checkCrawlerFiles({ distDir, files, config, report, pages });
  checkPosts({ manifest, distDir, report });
  checkPhotos({ distDir, files, report });
  checkTextFiles({ distDir, files, report, prelive, offerPatterns, claimPatterns });
  checkPlaceholders({ distDir, files, report, complete });

  return report;
}

function checkLinks({ pages, files, config, report, prelive }) {
  const fileSet = new Set(files);
  const banned = new Set(config.compliance.bannedPathSegments.map((segment) => segment.toLowerCase()));
  const idsFor = new Map();
  const ids = (file) => {
    if (!idsFor.has(file)) {
      const page = pages.get(file);
      idsFor.set(file, new Set(page ? findAll(page.doc, (n) => n.attrs.id).map((n) => n.attrs.id) : []));
    }
    return idsFor.get(file);
  };

  for (const [file, { doc }] of pages) {
    const base = `${config.origin}${urlForFile(file)}`;
    const references = [];
    walk(doc, (node) => {
      if (node.type !== 'element') return;
      for (const attr of ['href', 'src', 'action']) {
        if (node.attrs[attr] !== undefined) references.push({ node, value: node.attrs[attr] });
      }
      if (node.name === 'meta' && ['og:image', 'og:url'].includes(node.attrs.property)) references.push({ node, value: node.attrs.content ?? '' });
    });

    for (const { node, value } of references) {
      if (PHONE_SCHEMES.test(value)) {
        if (prelive) report.fail('rule 1', file, `Phone link "${value}". No tel: or sms: links before live mode.`);
        continue;
      }
      if (/^\s*javascript:/i.test(value)) {
        report.fail('links', file, `javascript: link on <${node.name}>.`);
        continue;
      }
      if (/^(mailto:|data:)/i.test(value)) continue;

      let url;
      try {
        url = new URL(value, base);
      } catch {
        report.fail('links', file, `Can't read the address "${value}".`);
        continue;
      }
      if (url.origin !== config.origin) continue;

      const path = decodeURIComponent(url.pathname);
      const segments = path.toLowerCase().split('/').filter(Boolean).map((segment) => segment.replace(/\.[a-z0-9]+$/, ''));
      const hit = segments.find((segment) => banned.has(segment));
      if (hit && prelive) report.fail('rule 1', file, `Link to ${path} points at a "${hit}" page.`);

      const target = resolveFile(path, fileSet);
      if (!target) {
        report.fail('links', file, `Broken link: ${value}`);
        continue;
      }
      if (url.hash && target.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1));
        if (id && !ids(target).has(id)) report.fail('links', file, `Link ${value} points at #${id}, which isn't on that page.`);
      }
    }
  }
}

function checkCrawlerFiles({ distDir, files, config, report, pages }) {
  const robotsPath = join(distDir, 'robots.txt');
  const robots = existsSync(robotsPath) ? readFileSync(robotsPath, 'utf8') : null;
  const headersPath = join(distDir, '_headers');
  const headers = existsSync(headersPath) ? readFileSync(headersPath, 'utf8') : '';

  if (!robots) {
    report.fail('crawlers', 'robots.txt', 'robots.txt is missing.');
  }

  if (config.mode === 'quiet') {
    if (robots) {
      const lines = robots.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
      const onlyBlocksAll = lines.length === 2 && /^user-agent:\s*\*$/i.test(lines[0]) && /^disallow:\s*\/$/i.test(lines[1]);
      if (!onlyBlocksAll) report.fail('quiet mode', 'robots.txt', 'In quiet mode robots.txt must be exactly "User-agent: *" and "Disallow: /".');
    }
    if (files.includes('sitemap.xml')) report.fail('quiet mode', 'sitemap.xml', 'Quiet mode has no sitemap. Delete dist and rebuild.');
    if (!/X-Robots-Tag:\s*noindex/i.test(headers)) report.fail('quiet mode', '_headers', 'In quiet mode _headers must send X-Robots-Tag: noindex.');
    return;
  }

  if (robots && /^disallow:\s*\/\s*$/im.test(robots)) report.fail('crawlers', 'robots.txt', `${config.mode} mode should let search engines in, but robots.txt blocks everything.`);
  if (/X-Robots-Tag:\s*noindex/i.test(headers.split('\n\n')[0])) report.fail('crawlers', '_headers', `${config.mode} mode shouldn't send X-Robots-Tag: noindex for every page.`);
  if (!files.includes('sitemap.xml')) {
    report.fail('crawlers', 'sitemap.xml', `${config.mode} mode needs sitemap.xml.`);
    return;
  }
  const sitemap = readFileSync(join(distDir, 'sitemap.xml'), 'utf8');
  const fileSet = new Set(files);
  for (const [, loc] of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(loc.replace(/&amp;/g, '&'));
    const target = url.origin === config.origin ? resolveFile(url.pathname, fileSet) : null;
    if (!target) {
      report.fail('crawlers', 'sitemap.xml', `Sitemap lists ${loc}, which doesn't exist.`);
      continue;
    }
    const robots = findAll(pages.get(target)?.doc ?? { children: [] }, (n) => n.name === 'meta' && n.attrs.name === 'robots')[0];
    if ((robots?.attrs.content ?? '').includes('noindex')) report.fail('crawlers', 'sitemap.xml', `Sitemap lists ${loc}, which is marked noindex.`);
  }
}

function checkPosts({ manifest, distDir, report }) {
  for (const post of manifest.posts ?? []) {
    // Rule 8. Every post says where its photos came from.
    if (!post.photos) {
      report.fail('rule 8', post.file, 'Add "photos: none", "photos: own" or "photos: employer-approved" to the front matter.');
    } else if (post.images.length && post.photos === 'none') {
      report.fail('rule 8', post.file, `The post has ${post.images.length} image(s) but says "photos: none". Say whose photos they are.`);
    }
    if (!post.stagePinned) {
      report.warn('journal', post.file, 'No "stage:" in the front matter, so "Written during" is worked out from dates. Add it to freeze it.');
    }
  }
  for (const draft of manifest.drafts ?? []) {
    if (existsSync(join(distDir, 'journal', draft.slug))) {
      report.fail('drafts', draft.file, 'This draft was built. Drafts must never reach dist/.');
    }
  }
}

function checkPhotos({ distDir, files, report }) {
  for (const file of files.filter((name) => /\.jpe?g$/i.test(name))) {
    if (jpegHasGps(readFileSync(join(distDir, file)))) {
      report.fail('rule 8', file, 'This photo has GPS location data, which can give away an address. Strip it before publishing.');
    }
  }
}

function checkTextFiles({ distDir, files, report, prelive, offerPatterns, claimPatterns }) {
  if (!prelive) return;
  for (const file of files.filter((name) => ['rss.xml', 'llms.txt'].includes(name))) {
    const text = normalizeText(readFileSync(join(distDir, file), 'utf8').replace(/<[^>]+>/g, ' '));
    for (const [phrase, pattern] of offerPatterns) {
      const hit = findPhrase(text, pattern);
      if (hit) report.fail('rule 1', file, `Offer phrase "${phrase}": "${hit}"`);
    }
    for (const [phrase, pattern] of claimPatterns) {
      const hit = findPhrase(text, pattern);
      if (hit) report.fail('rule 2', file, `Status claim "${phrase}": "${hit}"`);
    }
  }
}

function checkPlaceholders({ distDir, files, report, complete }) {
  const found = new Map();
  for (const file of files.filter((name) => /\.(html|xml|txt)$/.test(name) || name === '_headers')) {
    const text = readFileSync(join(distDir, file), 'utf8');
    for (const [placeholder] of text.matchAll(PLACEHOLDER_PATTERN)) {
      if (!found.has(placeholder)) found.set(placeholder, new Set());
      found.get(placeholder).add(file);
    }
  }
  for (const [placeholder, where] of found) {
    const message = `Placeholder still to fill: ${placeholder}`;
    const list = [...where].slice(0, 3).join(', ') + (where.size > 3 ? ` and ${where.size - 3} more` : '');
    if (complete) report.fail('placeholders', list, message);
    else report.warn('placeholders', list, message);
  }
}

function inspectJsonLd(value, config, problem, strings) {
  if (Array.isArray(value)) {
    for (const item of value) inspectJsonLd(item, config, problem, strings);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '@type') {
        for (const type of [].concat(child)) {
          if (!config.compliance.allowedSchemaTypes.includes(type)) problem(`JSON-LD type "${type}" isn't allowed. Use ${config.compliance.allowedSchemaTypes.join(', ')}.`);
        }
      } else if (config.compliance.bannedSchemaProperties.includes(key)) {
        problem(`JSON-LD property "${key}" isn't allowed before live mode.`);
      }
      inspectJsonLd(child, config, problem, strings);
    }
    return;
  }
  if (typeof value === 'string' && !/^https?:\/\//.test(value)) strings.push(value);
}

function findPeople(value, out = []) {
  if (Array.isArray(value)) value.forEach((item) => findPeople(item, out));
  else if (value && typeof value === 'object') {
    if ([].concat(value['@type']).includes('Person')) out.push(value);
    Object.values(value).forEach((child) => findPeople(child, out));
  }
  return out;
}

export function phrasePattern(phrase) {
  const clean = normalizeText(phrase);
  const body = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  const start = /^\w/.test(clean) ? '\\b' : '';
  const end = /\w$/.test(clean) ? '\\b' : '';
  return new RegExp(`${start}${body}${end}`, 'i');
}

function findPhrase(text, pattern) {
  const clean = normalizeText(text);
  const match = pattern.exec(clean);
  if (!match) return null;
  const from = Math.max(0, match.index - 25);
  const to = Math.min(clean.length, match.index + match[0].length + 25);
  return `${from > 0 ? '...' : ''}${clean.slice(from, to)}${to < clean.length ? '...' : ''}`;
}

function resolveFile(path, fileSet) {
  const clean = path.replace(/^\/+/, '');
  if (clean === '') return fileSet.has('index.html') ? 'index.html' : null;
  if (clean.endsWith('/')) return fileSet.has(`${clean}index.html`) ? `${clean}index.html` : null;
  if (fileSet.has(clean)) return clean;
  if (fileSet.has(`${clean}/index.html`)) return `${clean}/index.html`;
  return null;
}

function urlForFile(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return `/${file.slice(0, -'index.html'.length)}`;
  return `/${file}`;
}

function fileForUrl(url) {
  return url.endsWith('/') ? `${url.slice(1)}index.html` : url.slice(1);
}

/** True when a JPEG's EXIF block has a GPS section. */
export function jpegHasGps(buffer) {
  try {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
    let offset = 2;
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) return false;
      const marker = buffer[offset + 1];
      if (marker === 0xd9 || marker === 0xda) return false;
      const size = buffer.readUInt16BE(offset + 2);
      if (marker === 0xe1 && buffer.toString('latin1', offset + 4, offset + 10) === 'Exif\0\0') {
        const tiff = offset + 10;
        const little = buffer.toString('latin1', tiff, tiff + 2) === 'II';
        const u16 = (at) => (little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at));
        const u32 = (at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at));
        const ifd = tiff + u32(tiff + 4);
        const count = u16(ifd);
        for (let entry = 0; entry < count; entry += 1) {
          if (u16(ifd + 2 + entry * 12) === 0x8825) return true;
        }
        return false;
      }
      offset += 2 + size;
    }
  } catch {
    return false;
  }
  return false;
}

export function formatReport(report) {
  const lines = [`Check (${report.mode ?? 'unknown'} mode)`];
  const group = (heading, items, render) => {
    if (!items.length) return;
    lines.push('', `${heading} (${items.length})`);
    for (const item of items) lines.push(render(item));
  };
  group('Notes', report.notes, (n) => `  ${n.where}: ${n.message}`);
  group('Warnings', report.warnings, (w) => `  [${w.rule}] ${w.where}: ${w.message}`);
  group('Failures', report.failures, (f) => `  [${f.rule}] ${f.where}: ${f.message}`);
  lines.push('');
  lines.push(report.failures.length
    ? `Check failed with ${report.failures.length} failure(s). Nothing should deploy until they're fixed.`
    : `Check passed${report.warnings.length ? ` with ${report.warnings.length} warning(s)` : ''}.`);
  return lines.join('\n');
}

