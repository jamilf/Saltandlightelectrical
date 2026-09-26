# Keeping the site current

Sized for a busy apprentice. Everything here can be done from a phone through GitHub, except the yearly Node check.

## Monthly, about 30 minutes

- [ ] Write one journal entry (see "Adding a journal post" in `README.md`).
- [ ] Before publishing: employer's OK for anything from a job site, nothing identifying, photos declared, and read it aloud.

## Quarterly, about 15 minutes

- [ ] Update `content/milestones.json`: the current stage's `learning` line, and any stage you've finished (`current` becomes `done`, the next one becomes `current`).
- [ ] Add a line to the top of `revisions` with the next letter, today's date and what changed. That bumps the drawing's revision and the "last updated" date across the site.
- [ ] Commit, and check the Cloudflare build passed. On a computer, `node tools/build.mjs && node tools/check.mjs` shows the same result first.

## Yearly

- [ ] Renew the domain.
- [ ] Confirm the build still runs on the current Node LTS: `node --version`, then `node tools/build.mjs && node tools/check.mjs && node --test`. Update `.node-version` if Cloudflare's build needs a newer version.
- [ ] Read the About page for accuracy, including credentials. First aid certificates expire.
- [ ] Re-read the hard rules in `CLAUDE.md` against current NSW guidance (the links are in `LAUNCH.md`).
- [ ] If the launch year changes, update `site.launchYear`, the link preview image source in `tools/assets-src/og-default.html` and `site.ogImageAlt`, then re-render the image.
