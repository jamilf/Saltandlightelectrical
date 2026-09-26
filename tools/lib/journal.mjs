// Reads journal posts from content/journal/*.md. Files starting with _ are ignored,
// and posts with "draft: true" are listed as drafts but never built.
import { join } from 'node:path';
import { parseFrontMatter } from './frontmatter.mjs';
import { decodeEntities } from './html.mjs';
import { markdownToHtml } from './markdown.mjs';
import { stageForDate } from './milestones.mjs';
import { SiteError, formatDate, isIsoDate, readText, slugify, walkFiles, wordCount } from './util.mjs';

export const PHOTO_DECLARATIONS = ['none', 'own', 'employer-approved'];
export const RESERVED_IDS = ['main', 'top', 'follow-the-build'];

export function postSlug(file, data = {}) {
  const base = data.slug ?? file.replace(/\.md$/, '').replace(/^\d{4}-\d{2}(?:-\d{2})?-/, '');
  return slugify(base);
}

export function loadPosts({ root, config, milestones }) {
  const dir = join(root, 'content', 'journal');
  const files = walkFiles(dir).filter((file) => !file.includes('/') && file.endsWith('.md') && !file.startsWith('_'));
  const categories = new Map(config.journal.categories.map((category) => [category.slug, category]));
  const stageIds = new Map(milestones.stages.map((stage) => [stage.id, stage]));

  const posts = [];
  const drafts = [];
  const problems = [];

  for (const file of files) {
    const where = `content/journal/${file}`;
    const { data, body } = parseFrontMatter(readText(join(dir, file)), where);
    const slug = postSlug(file, data);

    if (data.draft === true) {
      drafts.push({ file, slug, title: data.title ?? slug });
      continue;
    }

    const local = [];
    if (typeof data.title !== 'string') local.push(`${where}: add a title, like "title: My first week".`);
    if (!isIsoDate(data.date)) local.push(`${where}: date must look like 2026-10-12.`);
    if (!categories.has(data.category)) {
      local.push(`${where}: category must be one of ${[...categories.keys()].join(', ')}.`);
    }
    if (data.stage != null && !stageIds.has(data.stage)) {
      local.push(`${where}: stage "${data.stage}" isn't in content/milestones.json. Use one of ${[...stageIds.keys()].join(', ')}.`);
    }
    if (data.updated != null && !isIsoDate(data.updated)) local.push(`${where}: updated must look like 2026-10-12.`);
    if (data.photos != null && !PHOTO_DECLARATIONS.includes(data.photos)) {
      local.push(`${where}: photos must be one of ${PHOTO_DECLARATIONS.join(', ')}.`);
    }
    if (!slug) local.push(`${where}: couldn't make a web address from the file name. Add "slug: my-post".`);
    if (local.length) {
      problems.push(...local);
      continue;
    }

    const converted = markdownToHtml(body, {
      topHeadingLevel: 2,
      reservedIds: RESERVED_IDS,
      resolveUrl: (url, kind) =>
        kind === 'image' && !/^([a-z][a-z0-9+.-]*:|\/)/i.test(url) ? `/journal/${url.replace(/^\.\//, '')}` : url,
    });
    const category = categories.get(data.category);
    const written = data.stage ? { stage: stageIds.get(data.stage), pinned: true } : stageForDate(milestones, data.date);
    const plain = decodeEntities(converted.html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

    posts.push({
      file,
      slug,
      url: `/journal/${slug}/`,
      title: data.title,
      date: data.date,
      dateLabel: formatDate(data.date),
      updated: data.updated ?? null,
      category,
      stage: written.stage,
      stagePinned: written.pinned,
      photos: data.photos ?? null,
      complianceNote: typeof data.compliance_note === 'string' && data.compliance_note.trim() ? data.compliance_note.trim() : null,
      summary: typeof data.summary === 'string' && data.summary.trim() ? data.summary.trim() : firstSentence(plain),
      html: converted.html,
      images: converted.images,
      readingMinutes: Math.max(1, Math.round(wordCount(plain) / config.journal.wordsPerMinute)),
      safetyNote: category.safetyNote === true,
    });
  }

  const seen = new Map();
  for (const post of posts) {
    if (seen.has(post.slug)) problems.push(`Two posts share the address /journal/${post.slug}/ (${seen.get(post.slug)} and ${post.file}). Add a different "slug:" to one.`);
    seen.set(post.slug, post.file);
  }
  if (problems.length) throw new SiteError(problems, 'Journal posts need fixing');

  posts.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  posts.forEach((post, index) => {
    post.newer = index > 0 ? posts[index - 1] : null;
    post.older = index < posts.length - 1 ? posts[index + 1] : null;
  });
  return { posts, drafts };
}

function firstSentence(text) {
  const sentence = text.match(/^.*?[.?](?=\s|$)/)?.[0] ?? text;
  return sentence.length > 155 ? `${sentence.slice(0, 152).replace(/\s+\S*$/, '')}...` : sentence;
}
