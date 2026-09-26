import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { byName, findAll, parseHtml, textOf } from '../tools/lib/html.mjs';
import { makeSite, rules } from './fixture.mjs';

const sites = [];
const fresh = () => {
  const site = makeSite();
  sites.push(site);
  return site;
};
after(() => sites.forEach((site) => site.cleanup()));

const read = (site, file) => readFileSync(join(site.dist, file), 'utf8');
const withForms = (site) =>
  site.config((config) => {
    config.forms.newsletter.endpoint = 'https://forms.example.com/newsletter';
    config.forms.contact.endpoint = 'https://forms.example.com/contact';
  });

test('"Follow the build" is word for word the same in the nav, the heading, the button and the success message', () => {
  const site = fresh();
  withForms(site);
  site.build();
  const doc = parseHtml(read(site, 'index.html'));
  const nav = findAll(doc, (n) => (n.attrs.class ?? '').includes('site-header__follow'))[0];
  const heading = findAll(doc, (n) => n.attrs.id === 'follow-heading')[0];
  const form = findAll(doc, (n) => n.attrs['data-form'] === 'newsletter')[0];
  const button = byName(form, 'button')[0];
  assert.equal(textOf(nav), 'Follow the build');
  assert.equal(textOf(heading), 'Follow the build');
  assert.equal(textOf(button), 'Follow the build');
  assert.equal(form.attrs['data-success'], "You're following the build. Expect a few emails a year.");
  assert.match(read(site, 'following/index.html'), /You(?:'|&#39;)re following the build\. Expect a few emails a year\./);
});

test('forms post to their endpoints, carry a honeypot, and the content security policy allows them', () => {
  const site = fresh();
  withForms(site);
  site.build();
  const contact = parseHtml(read(site, 'contact/index.html'));
  const form = findAll(contact, (n) => n.attrs['data-form'] === 'contact')[0];
  assert.equal(form.attrs.action, 'https://forms.example.com/contact');
  const trap = findAll(form, (n) => n.attrs.class === 'hp')[0];
  assert.equal(trap.attrs['aria-hidden'], 'true');
  assert.equal(byName(trap, 'input')[0].attrs.tabindex, '-1');
  assert.match(read(site, '_headers'), /form-action 'self' https:\/\/forms\.example\.com/);
  assert.match(read(site, 'contact/index.html'), /<script src="\/assets\/js\/site\.js\?v=[0-9a-f]+" defer><\/script>/);
  assert.doesNotMatch(read(site, 'about/index.html'), /site\.js/);
});

test('with the forms in place, the check still passes (no quote or job options)', () => {
  const site = fresh();
  withForms(site);
  assert.deepEqual(rules(site.check()), []);
});

test('without endpoints the forms fall back to an email link, or a placeholder when there is no email', () => {
  const site = fresh();
  site.build();
  assert.match(read(site, 'contact/index.html'), /\[\[BUILD: set forms\.contact\.endpoint or person\.email/);
  site.config((config) => {
    config.person.email = 'jamil@example.com';
  });
  site.build();
  assert.match(read(site, 'contact/index.html'), /<a href="mailto:jamil@example\.com">email me at jamil@example\.com<\/a>/);
  assert.match(read(site, 'index.html'), /email me to follow the build/);
});

test('only verified credentials appear, and in-progress ones say so', () => {
  const site = fresh();
  site.build();
  assert.doesNotMatch(read(site, 'about/index.html'), /White Card/);
  site.config((config) => {
    config.credentials = [
      { title: 'White Card (general construction induction)', status: 'completed', when: '2025', verified: true },
      { title: 'Certificate III in Electrotechnology Electrician', status: 'in-progress', when: 'since 2027', verified: true },
      { title: 'Something unconfirmed', status: 'completed', when: '2026', verified: false },
    ];
  });
  site.build();
  const about = textOf(parseHtml(read(site, 'about/index.html')));
  assert.match(about, /White Card \(general construction induction\), completed 2025/);
  assert.match(about, /Certificate III in Electrotechnology Electrician, in progress since 2027/);
  assert.doesNotMatch(about, /Something unconfirmed/);
});

test('the optional About sections stay off until their flags are on', () => {
  const site = fresh();
  site.build();
  assert.doesNotMatch(read(site, 'about/index.html'), /GracePoint|How I communicate/);
  site.config((config) => {
    config.features.aboutCommunity = true;
    config.features.aboutCommunication = true;
  });
  site.build();
  assert.match(read(site, 'about/index.html'), /GracePoint Presbyterian Church in Lidcombe/);
  assert.match(read(site, 'about/index.html'), /How I communicate/);
});

test('the two draft outlines are in the repo but never built', () => {
  const site = fresh();
  const { manifest } = site.build();
  assert.deepEqual(manifest.drafts.map((draft) => draft.slug).sort(), ['first-apprentice-log', 'why-im-building-early']);
});
