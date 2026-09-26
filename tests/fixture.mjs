// Test helper: a throwaway copy of the site in a temp folder, so tests can plant problems safely.
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../tools/lib/build.mjs';
import { runCheck } from '../tools/lib/check.mjs';

export const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function makeSite() {
  const root = mkdtempSync(join(tmpdir(), 'sle-test-'));
  for (const item of ['site.config.json', 'content', 'src']) {
    cpSync(join(projectRoot, item), join(root, item), { recursive: true });
  }
  const site = {
    root,
    dist: join(root, 'dist'),
    read(relative) {
      return readFileSync(join(root, relative), 'utf8');
    },
    write(relative, content) {
      mkdirSync(dirname(join(root, relative)), { recursive: true });
      writeFileSync(join(root, relative), content);
    },
    edit(relative, change) {
      site.write(relative, change(site.read(relative)));
    },
    config(change) {
      const config = JSON.parse(site.read('site.config.json'));
      change(config);
      site.write('site.config.json', JSON.stringify(config, null, 2));
    },
    build(mode) {
      return build({ root, mode });
    },
    check(mode) {
      const { manifest } = build({ root, mode });
      return runCheck({ root, manifest });
    },
    /** Swap every [[placeholder]] for plain words and add the bits prelaunch needs. */
    makeReadyForPrelaunch() {
      site.config((config) => {
        config.site.url = 'https://example.com.au';
        config.site.ogImage = '/assets/img/og-test.png';
        config.site.ogImageAlt = 'Test image';
      });
      site.write('src/assets/img/og-test.png', 'not really a png');
      for (const file of ['content/milestones.json', ...listPages(root)]) {
        site.edit(file, (text) => text.replace(/\[\[[^\]\n]*\]\]/g, 'Draft words'));
      }
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
  return site;
}

function listPages(root) {
  return ['index', 'road-to-launch', 'about', 'contact', 'privacy'].map((name) => `src/pages/${name}.html`);
}

export function rules(report, kind = 'failures') {
  return report[kind].map((item) => item.rule);
}

export function page(slug, body, title = `Test page ${slug}`) {
  return `---\ntitle: ${title}\ndescription: A test page called ${slug}.\n---\n<div class="wrap page">\n<h1>${title}</h1>\n${body}\n</div>\n`;
}

export function post({ title = 'A test post', date = '2026-10-01', category = 'apprentice-log', extra = '', body = 'Some words about the week.' } = {}) {
  return `---\ntitle: ${title}\ndate: ${date}\ncategory: ${category}\nsummary: A short summary of ${title}.\n${extra}---\n${body}\n`;
}
