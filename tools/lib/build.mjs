// Builds the site into dist/. Same inputs always give the same files, byte for byte.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { loadConfig, statusNoticeText } from './config.mjs';
import { headersFile, llmsTxt, robotsTxt, rssXml, sitemapXml } from './feeds.mjs';
import { parseFrontMatter } from './frontmatter.mjs';
import { loadPosts } from './journal.mjs';
import { renderDiagram } from './diagram.mjs';
import { loadMilestones } from './milestones.mjs';
import { jsonLdScript, pageTitle, robotsFor } from './seo.mjs';
import { render } from './template.mjs';
import { SiteError, formatDate, readText, shortHash, walkFiles } from './util.mjs';

/**
 * @param {{ root?: string, outDir?: string, mode?: string }} [options]
 * @returns {{ config: object, manifest: object, outDir: string }}
 */
export function build(options = {}) {
  const root = options.root ?? process.cwd();
  const outDir = options.outDir ?? join(root, 'dist');
  const config = loadConfig(root, { mode: options.mode });
  const milestones = loadMilestones(root, config);
  const { posts, drafts } = loadPosts({ root, config, milestones });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  copyDir(join(root, 'src', 'assets'), join(outDir, 'assets'));
  copyDir(join(root, 'src', 'static'), outDir);
  copyDir(join(root, 'content', 'journal', 'media'), join(outDir, 'journal', 'media'));

  const partials = loadFolder(join(root, 'src', 'partials'));
  const layouts = loadFolder(join(root, 'src', 'layouts'));
  if (!layouts.base) throw new SiteError('src/layouts/base.html is missing.');

  const assets = assetPaths(root, config);
  const latest = { ...milestones.latest, dateLabel: formatDate(milestones.latest.date) };
  const shared = {
    site: config.site,
    origin: config.origin,
    person: config.person,
    mode: { name: config.mode, quiet: config.mode === 'quiet', prelaunch: config.mode === 'prelaunch', live: config.mode === 'live' },
    notices: { ...config.notices, status: statusNoticeText(config) },
    milestones: {
      ...milestones,
      // Each stage lists the journal entries written during it, newest first, so the plan and
      // the record link to each other.
      stages: milestones.stages.map((stage) => {
        const written = posts.filter((post) => post.stage?.id === stage.id);
        return { ...stage, entries: written.slice(0, 3), entriesMore: Math.max(0, written.length - 3) };
      }),
      latest,
      revisions: milestones.revisions.map((revision) => ({ ...revision, dateLabel: formatDate(revision.date) })),
    },
    journal: {
      posts,
      latest: posts.slice(0, 3),
      categories: config.journal.categories.map((category) => ({ ...category, url: `/journal/${category.slug}/` })),
    },
    forms: config.forms,
    credentials: {
      shown: config.credentials.filter((credential) => credential.verified).map((credential) => ({ ...credential, inProgress: credential.status === 'in-progress' })),
      waiting: config.credentials.filter((credential) => !credential.verified).length,
    },
    features: config.features,
    analytics: config.analytics,
    followPath: config.followPath,
    assets,
    diagram: {
      full: renderDiagram(milestones, config, { variant: 'full' }),
      compact: renderDiagram(milestones, config, { variant: 'compact', link: true }),
    },
  };

  const written = [];
  const writePage = (page, content, extra = {}) => {
    const context = {
      ...shared,
      ...extra,
      page,
      nav: navFor(page.path, config),
      head: headFor(page, config, extra.post ?? null),
    };
    context.content = content;
    const html = tidy(render(layouts.base, context, { name: 'src/layouts/base.html', partials }));
    const file = fileForPath(page.path);
    writeFile(join(outDir, file), html);
    written.push({
      path: page.path,
      file,
      kind: page.kind,
      noindex: Boolean(page.noindex),
      sitemap: page.sitemap !== false && !page.noindex && page.path !== '/404.html',
      lastmod: page.lastmod ?? latest.date,
    });
  };

  // Pages in src/pages. Their front matter can use {{ values }} too.
  for (const file of walkFiles(join(root, 'src', 'pages')).filter((name) => name.endsWith('.html'))) {
    const where = `src/pages/${file}`;
    const { data, body } = parseFrontMatter(readText(join(root, 'src', 'pages', file)), where);
    const page = { kind: 'page', path: pathForPage(file), ...data };
    for (const key of ['title', 'metaTitle', 'description']) {
      if (typeof page[key] === 'string') page[key] = render(page[key], shared, { name: `${where} ${key}` });
    }
    if (!page.title || !page.description) throw new SiteError(`${where} needs a title and a description in its front matter.`);
    page.schema = typeof page.schema === 'string' ? page.schema.split(/\s+/) : [];
    const content = render(body, { ...shared, page, nav: navFor(page.path, config) }, { name: where, partials });
    writePage(page, content);
  }

  // Journal: index, one page per category, one page per post.
  const listing = (heading, intro, list, currentSlug) => ({
    heading,
    intro,
    posts: list,
    isIndex: currentSlug === null,
    categories: shared.journal.categories.map((category) => ({ ...category, current: category.slug === currentSlug })),
  });
  const journalPages = [
    {
      page: { kind: 'journal', path: '/journal/', title: 'Journal', description: `Dated entries from ${config.person.name} on the road to opening ${config.site.name}.`, lastmod: posts[0]?.date },
      listing: listing('Journal', 'Dated entries on the road to launch, newest first.', posts, null),
    },
    ...config.journal.categories.map((category) => {
      const inCategory = posts.filter((post) => post.category.slug === category.slug);
      return {
        // An empty category is a dead end in search results, so it stays out of them (and the
        // sitemap) until its first entry.
        page: { kind: 'journal', path: `/journal/${category.slug}/`, title: `${category.name} | Journal`, description: category.description, lastmod: inCategory[0]?.date, noindex: inCategory.length === 0 },
        listing: listing(category.name, category.description, inCategory, category.slug),
      };
    }),
  ];
  for (const { page, listing: data } of journalPages) {
    const content = render(layouts.journal, { ...shared, page, listing: data }, { name: 'src/layouts/journal.html', partials });
    writePage(page, content);
  }

  for (const post of posts) {
    const view = {
      ...post,
      categoryUrl: `/journal/${post.category.slug}/`,
      readingLabel: post.readingMinutes === 1 ? '1 minute' : `${post.readingMinutes} minutes`,
      hasPager: Boolean(post.older || post.newer),
    };
    const page = {
      kind: 'post',
      path: post.url,
      title: post.title,
      description: post.summary,
      ogType: 'article',
      schema: ['post'],
      lastmod: post.updated ?? post.date,
    };
    const content = render(layouts.post, { ...shared, page, post: view }, { name: 'src/layouts/post.html', partials });
    writePage(page, content, { post });
  }

  // Files for crawlers, feed readers and the host.
  writeFile(join(outDir, 'robots.txt'), robotsTxt(config));
  if (config.mode !== 'quiet') writeFile(join(outDir, 'sitemap.xml'), sitemapXml(written, config));
  writeFile(join(outDir, 'rss.xml'), rssXml(posts, config, posts[0]?.date ?? latest.date));
  writeFile(join(outDir, 'llms.txt'), llmsTxt(config, milestones, posts));
  writeFile(join(outDir, '_headers'), headersFile(config));

  const manifest = {
    mode: config.mode,
    origin: config.origin,
    pages: written,
    posts: posts.map((post) => ({
      file: `content/journal/${post.file}`,
      slug: post.slug,
      url: post.url,
      category: post.category.slug,
      photos: post.photos,
      images: post.images,
      complianceNote: post.complianceNote,
      safetyNote: post.safetyNote,
      stagePinned: post.stagePinned,
    })),
    drafts: drafts.map((draft) => ({ file: `content/journal/${draft.file}`, slug: draft.slug })),
  };
  return { config, manifest, outDir };
}

function headFor(page, config, post) {
  const url = `${config.origin}${page.path}`;
  const ogImage = config.site.ogImage ? `${config.origin}${config.site.ogImage}` : null;
  return {
    title: pageTitle(page, config),
    description: page.description,
    robots: robotsFor(page, config),
    canonical: page.path === '/404.html' ? null : url,
    url,
    ogType: page.ogType ?? 'website',
    ogTitle: page.metaTitle ?? page.title,
    ogImage,
    ogImageAlt: config.site.ogImageAlt ?? '',
    twitterCard: ogImage ? 'summary_large_image' : 'summary',
    jsonLd: jsonLdScript(page.schema ?? [], config, post),
  };
}

function navFor(path, config) {
  return config.nav.map((item) => {
    const exact = item.path === path;
    const within = item.path !== '/' && path.startsWith(item.path);
    return { ...item, current: exact || within, currentValue: exact ? 'page' : 'true' };
  });
}

function assetPaths(root, config) {
  const versioned = (relative) => {
    const file = join(root, 'src', 'assets', relative);
    return existsSync(file) ? `/assets/${relative}?v=${shortHash(readFileSync(file))}` : null;
  };
  return {
    css: versioned('css/site.css'),
    js: versioned('js/site.js'),
    font400: '/assets/fonts/poppins-400.woff2',
    favicon: existsSync(join(root, 'src', 'static', 'favicon.svg')) ? '/favicon.svg' : null,
    faviconIco: existsSync(join(root, 'src', 'static', 'favicon.ico')) ? '/favicon.ico' : null,
    appleTouchIcon: existsSync(join(root, 'src', 'static', 'apple-touch-icon.png')) ? '/apple-touch-icon.png' : null,
    analyticsToken: config.analytics.cloudflareWebAnalyticsToken,
  };
}

export function pathForPage(file) {
  const name = file.replace(/\.html$/, '');
  if (name === 'index') return '/';
  if (name === '404') return '/404.html';
  return `/${name.replace(/\/index$/, '')}/`;
}

export function fileForPath(path) {
  if (path.endsWith('.html')) return path.slice(1);
  return `${path.slice(1)}index.html`;
}

function loadFolder(dir) {
  const out = {};
  for (const file of walkFiles(dir).filter((name) => name.endsWith('.html'))) {
    out[file.replace(/\.html$/, '')] = readText(join(dir, file));
  }
  return out;
}

function copyDir(from, to) {
  if (existsSync(from)) cpSync(from, to, { recursive: true, filter: (source) => !basename(source).startsWith('.') });
}

function writeFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function tidy(html) {
  return `${html.replace(/[ \t]+$/gm, '').replace(/\n{2,}/g, '\n').trim()}\n`;
}
