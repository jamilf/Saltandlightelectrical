import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { byName, findAll, parseHtml, textOf } from '../tools/lib/html.mjs';
import { makeSite } from './fixture.mjs';

const sites = [];
const fresh = () => {
  const site = makeSite();
  sites.push(site);
  return site;
};
after(() => sites.forEach((site) => site.cleanup()));

const panels = (html) => findAll(parseHtml(html), (n) => (n.attrs.class ?? '').split(' ').includes('sld'));
const stagesOf = (panel) => byName(panel, 'li').filter((li) => (li.attrs.class ?? '').includes('sld__stage'));
const hasClass = (node, name) => (node.attrs.class ?? '').split(' ').includes(name);

test('the full diagram is an ordered list with one item per stage, states in plain text', () => {
  const site = fresh();
  site.build();
  const [panel] = panels(readFileSync(join(site.dist, 'road-to-launch/index.html'), 'utf8'));
  const items = stagesOf(panel);
  assert.equal(items.length, 8);
  assert.deepEqual(items.map((li) => textOf(findAll(li, (n) => hasClass(n, 'sld__state'))[0])), ['Done', 'Done', 'Now', 'Planned', 'Planned', 'Planned', 'Planned', 'Planned']);
  assert.match(textOf(items[7]), /Salt and Light Electrical opens, target 2032/);
  assert.ok(findAll(panel, (n) => n.name === 'svg').every((svg) => svg.attrs['aria-hidden'] === 'true' || svg.parent.attrs['aria-hidden'] === 'true'));
  assert.match(textOf(panel), /Drawing SLE-001/);
  assert.match(textOf(panel), /Drawn by J\. Flores/);
});

test('only wires up to the current stage are energised, and their timing stays within the CSS classes', () => {
  const site = fresh();
  site.build();
  const [panel] = panels(readFileSync(join(site.dist, 'road-to-launch/index.html'), 'utf8'));
  const items = stagesOf(panel);
  const live = items.map((li) => findAll(li, (n) => hasClass(n, 'sld__live')).length);
  assert.deepEqual(live, [2, 2, 1, 0, 0, 0, 0, 0]);
  for (const span of findAll(panel, (n) => hasClass(n, 'sld__live'))) {
    const delay = Number(span.attrs.class.match(/\bdl-(\d+)/)[1]);
    const duration = Number(span.attrs.class.match(/\bdu-(\d+)/)[1]);
    assert.ok(delay >= 0 && delay <= 20, span.attrs.class);
    assert.ok(duration >= 1 && duration <= 5, span.attrs.class);
  }
});

test('the compact diagram collapses done stages and the far future on narrow screens', () => {
  const site = fresh();
  site.build();
  const [panel] = panels(readFileSync(join(site.dist, 'index.html'), 'utf8'));
  const items = stagesOf(panel);
  const summary = items.find((li) => hasClass(li, 'sld__stage--summary'));
  const gap = items.find((li) => hasClass(li, 'sld__stage--gap'));
  assert.match(textOf(summary), /S1 to S2 Two stages done/);
  assert.match(textOf(gap), /S5 to S7 Three more stages/);
  const collapsible = items.filter((li) => hasClass(li, 'sld__stage--collapsible')).map((li) => textOf(findAll(li, (n) => hasClass(n, 'sld__ref'))[0]));
  assert.deepEqual(collapsible, ['S1', 'S2', 'S5', 'S6', 'S7']);
  assert.match(textOf(panel), /See the full road to launch/);
});

test('changing only the milestones data updates the diagram, the stage list and the status block', () => {
  const site = fresh();
  site.edit('content/milestones.json', (text) => {
    const data = JSON.parse(text);
    data.stages.find((stage) => stage.id === 'finding-apprenticeship').status = 'done';
    const apprenticeship = data.stages.find((stage) => stage.id === 'apprenticeship');
    apprenticeship.status = 'current';
    apprenticeship.learning = 'Reading circuit diagrams';
    return JSON.stringify(data, null, 2);
  });
  site.build();

  const home = readFileSync(join(site.dist, 'index.html'), 'utf8');
  const road = readFileSync(join(site.dist, 'road-to-launch/index.html'), 'utf8');

  const [full] = panels(road);
  assert.deepEqual(stagesOf(full).map((li) => textOf(findAll(li, (n) => hasClass(n, 'sld__state'))[0])).slice(0, 5), ['Done', 'Done', 'Done', 'Now', 'Planned']);
  assert.ok(hasClass(stagesOf(full)[3], 'is-current'));

  const [compact] = panels(home);
  assert.match(textOf(compact), /S1 to S3 Three stages done/);

  const status = textOf(findAll(parseHtml(home), (n) => hasClass(n, 'status-block'))[0]);
  assert.match(status, /Now Apprenticeship and Certificate III in Electrotechnology Electrician \(UEE30820\)/);
  assert.match(status, /Learning Reading circuit diagrams/);
  assert.match(status, /Next Qualified supervisor certificate, electrician/);

  const notes = textOf(findAll(parseHtml(road), (n) => hasClass(n, 'stage-notes'))[0]);
  assert.match(notes, /S4\. Apprenticeship and Certificate III.*Now\./);
});

test('in live mode the path reaches the lamp and the lamp is lit', () => {
  const site = fresh();
  site.config((config) => {
    config.site.url = 'https://example.com.au';
    config.licence = { holderName: 'Test Holder', businessName: null, number: '123456C', phone: '02 0000 0000' };
  });
  site.edit('content/milestones.json', (text) => text.replace(/"status": "(current|planned)"/g, '"status": "done"').replace(/("kind": "load",\s*"status": )"done"/, '$1"planned"'));
  site.build('live');
  const [panel] = panels(readFileSync(join(site.dist, 'road-to-launch/index.html'), 'utf8'));
  const lamp = stagesOf(panel).at(-1);
  assert.ok(hasClass(lamp, 'is-lit'));
  assert.equal(findAll(lamp, (n) => hasClass(n, 'sld__live')).length, 1);
  assert.match(textOf(panel), /Status Trading/);
});
