// Start a journal post: node tools/new-post.mjs "Your title" [--category apprentice-log]
// Creates content/journal/YYYY-MM-DD-your-title.md with the front matter filled in,
// including the stage you're in today, and marks it as a draft.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from './lib/config.mjs';
import { loadMilestones } from './lib/milestones.mjs';
import { SiteError, slugify } from './lib/util.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { category: { type: 'string', default: 'apprentice-log' } },
});

try {
  const title = positionals.join(' ').trim();
  if (!title) throw new SiteError('Give the post a title: node tools/new-post.mjs "My first week"');
  const config = loadConfig(root);
  const slugs = config.journal.categories.map((category) => category.slug);
  if (!slugs.includes(values.category)) throw new SiteError(`--category must be one of ${slugs.join(', ')}.`);
  const milestones = loadMilestones(root, config);
  const stage = milestones.current ?? milestones.done[milestones.done.length - 1];

  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const file = join(root, 'content', 'journal', `${date}-${slugify(title)}.md`);
  if (existsSync(file)) throw new SiteError(`${file} already exists. Pick a different title.`);

  writeFileSync(file, [
    '---',
    `title: ${JSON.stringify(title)}`,
    `date: ${date}`,
    `category: ${values.category}`,
    'summary: "[[JAMIL: one line for the journal list and link previews]]"',
    `stage: ${stage.id}`,
    'photos: none                    # none, own or employer-approved',
    'draft: true                     # delete this line when it is ready to publish',
    '---',
    '',
    'Write here.',
    '',
  ].join('\n'));
  console.log(`Created ${file.slice(root.length + 1)}`);
} catch (error) {
  if (error instanceof SiteError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
