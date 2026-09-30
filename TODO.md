# To do

The site has no `[[placeholders]]` left, so it's ready to deploy in quiet mode. What's below is what Jamil needs to supply or check before switching to prelaunch. The check lists anything that blocks prelaunch.

## In Cloudflare

- [ ] Delete the Web Analytics entries for saltandlightelectrical.com (see "Cloudflare's automatic analytics" in `DEPLOY.md`). Cloudflare adds its script by default; the site blocks it, which shows up as a browser console error.
- [x] `www.saltandlightelectrical.com` added as a custom domain, and it loads.
- [ ] Turn off the `workers.dev` address, so the site has one address.

## Settings in `site.config.json`

- [x] `site.url`: https://saltandlightelectrical.com
- [ ] `person.email`: a contact address, or set up the forms below. Prelaunch needs one or the other.
- [ ] `person.linkedin`: your LinkedIn address, if you want it linked from the home page, footer and structured data.
- [ ] `forms.newsletter.endpoint` and `provider`: the newsletter service, once chosen.
- [ ] `forms.contact.endpoint` and `provider`: the contact form service, once chosen.
- [ ] `person.jobTitle`: set to "Electrical apprentice" once your apprenticeship starts, and change `person.statusPhrase` to "an electrical apprentice" at the same time.
- [ ] `person.photo`: add a photo for the About page when you have one you like (`{ "src": "/assets/img/jamil.jpg", "alt": "..." }`).
- [ ] Optional: `analytics.cloudflareWebAnalyticsToken`, `analytics.googleSiteVerification`, `analytics.bingSiteVerification`.

## Read aloud and rewrite anything that isn't you

These were drafted for you. Some state things about you that came from the brief or were reasonable guesses, and those are marked **check**.

### Home
- [ ] Hero heading and line: "Building Salt and Light Electrical in public", then "I'm Jamil, and I'm looking for an electrical apprenticeship in Western Sydney. Every step from apprentice to licensed contractor gets a date and a place on this site, so there's a record anyone can check."
- [ ] The caption under the hero drawing: "A lamp on its stand, with the power on its way. It stays off until the business opens."
- [ ] Why the name.
- [ ] What I'm building, including the two promises and "Until then, I'm not offering electrical work of any kind." The line under the first promise was drafted for you: "Tidy, safe work that nobody has to come back and fix."

### Road to launch
- [ ] The introduction explaining the drawing.
- [ ] Each stage's note, in `content/milestones.json`.
- [ ] **Check** S3 learning line: "How apprenticeships work in NSW, and what employers look for in a first-year apprentice".
- [ ] **Check** S3 note: "Finding the right employer matters more than finding the first one."
- [ ] **Check** timings: S4 "About four years", S5 "After the apprenticeship", S6 "Until opening", S7 "Before opening". Swap in years once you know them.
- [x] S5 and S7 explanations checked on 26 September 2026 against the NSW pages listed in `LAUNCH.md`. They match.

### About
- [ ] **Check** "Why the trade". The brief didn't give your reasons for changing careers, so these were drafted for you: wanting work that lasts and that you can see, getting off the screen, the power underneath the IT systems you looked after, and wanting to run your own business one day. Replace anything that isn't your real reason.
- [ ] **Check** the IT paragraph: "keeping the systems businesses rely on up and running. It taught me good habits. I learnt to write down what I did and why, and to stay calm when something breaks at the worst possible moment."
- [ ] "Why the name": Matthew 5:13-16, the lamp on a stand, and "It's a standard I'm asking to be measured against."
- [ ] **Check** "Faith and work". It's written as your own beliefs: ordinary work matters to God (Colossians 3:23), loving your neighbour, being trusted with very little (Luke 16:10), and that the "do the work once, and do it properly" promise comes from your faith. Make sure it says what you believe, in words you'd use.
- [ ] **Check** credentials in `site.config.json`: the Certificate II's exact title and code, and that your White Card and first aid certificate are current. Set `verified` to false for anything you can't confirm.
- [ ] **Check** before switching on `features.aboutCommunity`: the GracePoint paragraph.
- [ ] **Check** before switching on `features.aboutCommunication`: the therapy assistant paragraph.

### Contact
- [ ] "I'd like to hear from tradies, mentors, builders, architects and anyone following along."
- [ ] The five reasons in the dropdown (`src/partials/contact-form.html`).

### Privacy
- [ ] The whole page. It makes promises in your name, like "I don't add them to the email list and I don't share them."

### Journal
- [ ] **Check** the first entry, "Why I'm building a business six years early". It's published. Set `draft: true` to take it down while you rewrite it.
- [ ] The four category descriptions in `site.config.json`.
- [ ] Read aloud the draft How it works entry, "How to read a single-line diagram" (`content/journal/2026-09-30-how-to-read-a-single-line-diagram.md`). It sticks to general information and doesn't describe anything you've done. Delete its `draft: true` line to publish it.
- [ ] Your first apprentice log: `content/journal/2026-09-26-first-apprentice-log.md` has the outline, with `[[FIRST_APPRENTICE_LOG_TOPIC]]` as the title. It stays a draft until you write it.

### Link preview image
- [ ] The image says "Built in public by Jamil Flores, from apprentice to licensed contractor." and "Not trading yet. Planned to open in 2032, once licensed." Its source is `tools/assets-src/og-default.html`.

## Before launch

- [ ] Commission a proper logo. The Wired S mark is a clean placeholder.
- [ ] Everything in `LAUNCH.md`.
