# Salt and Light Electrical

The pre-launch website for Salt and Light Electrical, built in public by Jamil Flores from apprentice to licensed contractor. The business isn't trading. It's planned to open in 2032, once licensed.

The site is plain HTML, CSS and a little JavaScript, built by a few Node scripts. There's nothing to install: no framework, no npm packages. Any recent Node (22 or later) runs it.

## Commands

Run these from the project folder.

| Command | What it does |
|---|---|
| `node tools/build.mjs` | Builds the site into `dist/` |
| `node tools/check.mjs` | Checks the built site against the rules and exits with an error if anything fails |
| `node --test` | Runs the tests |
| `node tools/serve.mjs` | Previews `dist/` at http://localhost:8080 |
| `node tools/new-post.mjs "Title"` | Starts a journal post, marked as a draft |
| `node tools/build.mjs --mode prelaunch` | Builds in another mode without changing the config, for testing |

Before pushing a change, run `node tools/build.mjs && node tools/check.mjs && node --test`. Cloudflare runs the first two on every push (the `build` section of `wrangler.jsonc` makes wrangler run them before it deploys), and a failed check means nothing deploys.

## Adding a journal post

**On a computer:** run `node tools/new-post.mjs "Your title" --category apprentice-log`. It creates a file in `content/journal/` with the date and your current stage filled in. Write the post, delete the `draft: true` line, then build, check and push.

**On your phone:** in the GitHub app or on github.com, open `content/journal/_template.md`, copy its text, and create a new file in `content/journal/` named with the date and a few words, like `2026-10-12-first-week.md`. Paste, write, delete the `draft: true` line and commit. Cloudflare builds it. If the check fails, the post doesn't go up, and the build log says why.

Each post starts with front matter:

```
---
title: My first week
date: 2026-10-12
category: apprentice-log          # apprentice-log, how-it-works, tools-and-kit or building-the-business
summary: One line for the journal list and link previews.
stage: finding-apprenticeship     # the stage you're in, from content/milestones.json
photos: none                      # none, own, employer-approved or licensed, or a list
draft: true                       # delete this line to publish
---
```

The body is Markdown: a blank line between paragraphs, `## ` for a heading, `- ` for a list, `[text](link)` for a link, and `![description](media/photo.jpg)` for a photo stored in `content/journal/media/`.

Posts in How it works get the safety note automatically. A post with photos must say where they came from: `photos: own`, `photos: employer-approved` or `photos: licensed`, or a list like `photos: own, licensed`. Licensed photos need a `## Photo credits` section naming each photo's author, licence and source. The check fails on photos that carry GPS location data.

An image on a line of its own becomes a figure, and the text in quotes after its address becomes the caption: `![A switchboard](media/board.jpg "Inside a switchboard")`.

Each post links to the stage it was written in, and that stage's note on the road to launch lists its three newest posts. A category page stays out of search results until its first post.

## Updating the road to launch

Everything on the road to launch comes from `content/milestones.json`: the diagram, the stage notes, the status block on the home page, and the revision letter and date in the footer.

- **Finishing a stage:** change its `status` from `current` to `done`, and the next stage's from `planned` to `current`. Exactly one stage is `current`.
- **What you're learning:** update the `learning` line on the current stage.
- **Every update:** add a line to the top of `revisions` with the next letter, today's date and what changed. That bumps the drawing's revision and the "last updated" date everywhere.

## Modes

`site.config.json` has a `mode`:

- **quiet**: the site is online but hidden from search engines. Every page says noindex, robots.txt blocks all crawlers, and there's no sitemap. This is where it starts.
- **prelaunch**: public and indexed. Needs `site.url`, and a way to reach you (`person.email` or the form endpoints). The check fails on any `[[placeholder]]` left in the site.
- **live**: for when the business is licensed and trading. It won't build without the licence details. Don't switch to it until every item in `LAUNCH.md` is done.

## Deploying

The site is hosted on Cloudflare, built straight from this GitHub repository. See [`DEPLOY.md`](DEPLOY.md) for the step-by-step setup.

## Where things live

```
site.config.json        mode, identity, notice wording, forms, flags and the phrase lists the check uses
content/milestones.json the road to launch stages and revision history
content/journal/        journal posts (Markdown) and their photos in media/
src/pages/              one HTML file per page, with a little front matter
src/partials/           shared pieces: header, footer, status notice, forms, notes
src/layouts/            the page wrapper, the journal list and the post layout
src/assets/             the stylesheet, the form script, fonts and images
tools/                  build, check, preview and new-post scripts, and their shared code in tools/lib
tools/assets-src/       sources for the favicon and the link preview image
tests/                  tests for all of the above (node --test)
dist/                   the built site (not committed)
```

Other docs: [`CLAUDE.md`](CLAUDE.md) for working on the site with Claude, [`TODO.md`](TODO.md) for what's left to fill in, [`MAINTENANCE.md`](MAINTENANCE.md) for keeping it current, and [`LAUNCH.md`](LAUNCH.md) for the checklist before live mode.

Poppins is used under the SIL Open Font License (`src/assets/fonts/OFL.txt`).
