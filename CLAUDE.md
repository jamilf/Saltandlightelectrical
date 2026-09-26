# Working on this site

This is the pre-launch website for Salt and Light Electrical, an electrical contracting business Jamil Flores plans to open in 2032, once licensed. Until then the business isn't trading, and the site documents the road from apprentice to licensed contractor in public. It must never read as an advertisement for electrical work.

The site is static HTML, CSS and a small amount of vanilla JavaScript, built with plain Node and no npm dependencies. Keep it that way: no frameworks, no packages, no build tools beyond `node`.

## Modes

`site.config.json` sets `mode`:

- **quiet**: deployed but hidden. noindex and nofollow on every page, robots.txt disallows everything, no sitemap. Placeholders are warnings.
- **prelaunch**: public and indexed. Needs `site.url` and a way to reach Jamil. Placeholders fail the check.
- **live**: only for when the business is licensed and trading. The build refuses to run without the licence details. Nothing beyond that guard is built yet; see `LAUNCH.md`.

## The hard rules

These protect Jamil legally and override everything else. If Jamil asks for something that breaks them, point it out and ask for the contractor licence details before doing it.

Why they exist: in NSW it's an offence to advertise electrical wiring work of any value without a current contractor licence, and licensed contractors must show the licensee's name and licence number in all advertising. A qualified supervisor certificate on its own doesn't allow contracting or advertising. The Australian Consumer Law separately bans misleading claims, including fake reviews.

While the site mode is "quiet" or "prelaunch":

1. Don't offer, advertise or imply electrical services anywhere, including page titles, meta descriptions and link previews. No service lists, prices, quote or booking forms, "call now" buttons, tel: links, or service-area and suburb pages.
2. Never describe me as a licensed electrician, electrical contractor or qualified electrician. Use my actual status from config, for example "electrical apprentice".
3. Write future plans as plans with a year attached ("planned for 2032, once licensed"), never as current offerings.
4. No testimonials, reviews, ratings, client logos, project counts or "trusted by" claims.
5. Every page shows the status notice. The confirmed wording lives in `site.config.json` (`notices.status`): "Salt and Light Electrical isn't trading yet. Jamil Flores is {statusPhrase} and doesn't offer electrical services or hold an electrical contractor licence."
6. Structured data is limited to WebSite, Person and BlogPosting. No Electrician, LocalBusiness or HomeAndConstructionBusiness types, and no areaServed, telephone, priceRange, review or aggregateRating properties.
7. No DIY electrical instructions, even simple ones. Explaining how things work is fine, with the safety note attached.
8. Job-site content only with my employer's OK, and never anything that identifies a client, address, house number, number plate, face, or my employer's confidential work.

In "live" mode:

9. The build fails unless the licensee name (or registered business name), contractor licence number and business phone are set in config, and those details must render on every page.

`tools/check.mjs` enforces rules 1, 5, 6 and 9, and parts of 2 and 8. The rest are editorial: follow them when writing, and flag anything borderline to Jamil.

Only three elements may carry `data-compliance="allow"`: the status notice, the safety note and the contact disclaimer. Their wording comes from `site.config.json`, and the check fails if a page changes it. Never add the marker anywhere else.

## Voice and copy

- First person ("I"), since it's just Jamil. Warm, practical, a little dry humour. Plain English a 12-year-old could follow. Explain any trade term in a short clause the first time it appears.
- Australian English: colour, organise, metre, licence (noun) and license (verb), enquiry.
- Sentence case everywhere: headings, buttons, nav, labels and title blocks.
- No em dashes. No exclamation marks. Vary sentence length. Short paragraphs, one idea each.
- Don't use: elevate, unlock, seamless, empower, leverage, cutting-edge, robust, delve, journey, passionate, world-class, one-stop shop, "quality you can trust", "In today's...", "Whether you're X or Y", "It's not just X, it's Y", rhetorical questions as openers, or lists of three used for rhythm.
- Buttons say exactly what happens. Error messages say what went wrong and how to fix it, without apologising.
- The action to subscribe is always called "Follow the build", word for word.
- Describe the future business as commercial and technical electrical work, and nothing narrower. The About story uses trade-first framing.
- The name comes from Matthew 5:13-16. Mentions of faith stay sincere and welcoming to people who don't share it. The fuller version lives on the About page ("Why the name" and "Faith and work", expanded at Jamil's request). Everywhere else, keep it brief.
- Never invent experiences, quotes, numbers, dates or credentials. Where Jamil's input is needed, write a placeholder like `[[JAMIL: one sentence on ...]]` and add it to `TODO.md`.
- If a local `private.check.json` exists, the check fails on the words it lists. Never commit that file, and never copy its words anywhere.

## Design

Warm, calm and exact, like a neat switchboard and a well-drawn plan. The road to launch diagram is the one bold element; everything else stays quiet.

- **Colour tokens** (in `src/assets/css/site.css`): salt #F6F7F5 background, paper #FFFFFF raised surfaces, ink #18263A text, ink-soft #4A5A70 secondary text, blueprint #0A2B5E headings, links and panels, filament #F5B301 amber, rule #D8DDE3 hairlines, wire #9DC1EE light blue on blueprint, field #74839A form borders, alert #A32A1C error text.
- **Amber is rare:** only the current stage, the lit lamp and the primary button fill (with blueprint text). Never amber text on a light background. One amber button per screen.
- **Three-core colours** (brown, blue, green and yellow) appear once, as the stripe above the footer.
- **Type:** Poppins 400, 500 and 600, self-hosted. Courier New only inside blueprint panels. Body 17 to 18px, line height about 1.65, scale 1.25, lines under 70 characters, left aligned.
- **Shape:** radius by role (2px panels, 6px controls, 12px form panels). Soft blue-tinted shadows only on genuinely raised things.
- **Light theme only.** No dark mode.
- **Motion:** small, and only where it has a job. The road to launch energises on load: the path draws, each contact closes as the power arrives, and the current contact glows twice. Pages fade into each other, "Follow the build" glides down the home page, controls ease between colours and form messages settle in. Nothing loops, and none of it runs under reduced motion (`tests/motion.test.mjs` checks the stylesheet). The styleguide lists it all.
- **Avoid:** cream backgrounds with serif displays and terracotta; dark themes with acid green; gradients, glassmorphism and blobs; identical cards with identical shadows; icon-plus-three-words rows; all-caps labels, eyebrow labels, one highlighted word in a headline, arrows on links, "A · B · C" meta strings; 01/02/03 markers unless the content is a real sequence; lightning bolts, sparks, hard hats, hi-vis clichés and emoji; pop-ups, fake stats, placeholder logos and lorem ipsum.
- Real photos only. No stock photos and no AI-generated people.

`/styleguide/` shows every component.

## Turning Jamil's notes into a journal post

1. Keep Jamil's words and their order. Fix spelling and grammar only.
2. Ask before rewriting anything beyond that.
3. Add the front matter (see `content/journal/_template.md`): title in sentence case, date, category, a one-line summary, the current stage, and the photos declaration.
4. Never add experiences Jamil didn't describe.
5. Run `node tools/build.mjs && node tools/check.mjs` and fix anything it reports.

## Publishing checklist

- [ ] Employer's OK for any job-site content.
- [ ] Nothing identifying: no client names, addresses, house numbers, number plates, faces or confidential work.
- [ ] Photos declared (`own` or `employer-approved`), and no GPS data in them.
- [ ] How it works posts have the safety note (added automatically).
- [ ] No DIY instructions.
- [ ] Jamil has read it aloud.

## Commands

```
node tools/build.mjs                    build into dist/
node tools/check.mjs                    run the compliance, metadata and link check
node --test                             run the tests
node tools/serve.mjs                    preview at http://localhost:8080
node tools/new-post.mjs "Title"         start a draft post
node tools/build.mjs --mode prelaunch   build in another mode for testing
```

## When the check fails

Read the failure: it names the rule, the file and what's wrong. Fix the content, not the check. Never weaken a rule, add to the allow list, or edit the phrase lists to get a build through. If a post genuinely needs a flagged phrase (quoting an ad to explain why this site never uses it, for example), add `compliance_note: the reason` to its front matter. That turns the failure into a warning and prints the reason on every run.
