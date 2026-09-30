import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { heroArt, nameArt, recordsArt, workArt } from '../tools/lib/art.mjs';
import { makeSite } from './fixture.mjs';

const sites = [];
after(() => sites.forEach((site) => site.cleanup()));

const stages = (current) => [
  ...Array.from({ length: 7 }, (_, index) => ({ isCurrent: index === current })),
  { isLoad: true, isCurrent: false },
];
const nodeStates = (svg) => [...svg.matchAll(/class="node node--(\w+)/g)].map((match) => match[1]);
const liveEnd = (svg) => Number(svg.match(/class="ln ln--live[^"]*" pathLength="1" d="[^"]*H(\d+)"/)[1]);
const nodeX = (svg, state) => Number(svg.match(new RegExp(`class="node node--${state}[^"]*" cx="(\\d+)"`))[1]);

test('the hero drawing runs the power to the current stage, with a node for each stage', () => {
  const svg = heroArt({ stages: stages(2) }, { mode: 'quiet' });
  assert.deepEqual(nodeStates(svg), ['done', 'done', 'now', 'planned', 'planned', 'planned', 'planned']);
  assert.equal(liveEnd(svg), nodeX(svg, 'now'));
  assert.doesNotMatch(svg, /\blit\b/);

  const later = heroArt({ stages: stages(5) }, { mode: 'quiet' });
  assert.deepEqual(nodeStates(later), ['done', 'done', 'done', 'done', 'done', 'now', 'planned']);
  assert.equal(liveEnd(later), nodeX(later, 'now'));
});

test('the hero lamp only lights in live mode, with the power all the way to it', () => {
  const svg = heroArt({ stages: stages(-1) }, { mode: 'live' });
  assert.deepEqual([...new Set(nodeStates(svg))], ['done']);
  assert.match(svg, /\blit\b/);
  assert.equal(liveEnd(svg), 372);
});

test('the drawings are decoration: hidden from screen readers, no text, and every drawn stroke can animate', () => {
  for (const svg of [heroArt({ stages: stages(2) }, { mode: 'quiet' }), nameArt(), workArt(), recordsArt()]) {
    assert.match(svg, /^<svg class="art [^"]*" viewBox="[^"]+" focusable="false" aria-hidden="true">/);
    assert.doesNotMatch(svg, /<text|style=/);
    for (const [element] of svg.matchAll(/<[a-z]+ class="[^"]*\bd\b[^"]*"[^>]*>/g)) assert.match(element, /pathLength="1"/, element);
  }
});

test('the home page shows the four drawings, and the hero follows content/milestones.json', () => {
  const site = makeSite();
  sites.push(site);
  site.edit('content/milestones.json', (text) => {
    const data = JSON.parse(text);
    data.stages.find((stage) => stage.id === 'finding-apprenticeship').status = 'done';
    data.stages.find((stage) => stage.id === 'apprenticeship').status = 'current';
    return JSON.stringify(data, null, 2);
  });
  site.build();
  const home = readFileSync(join(site.dist, 'index.html'), 'utf8');
  assert.equal((home.match(/<svg class="art /g) ?? []).length, 4);
  assert.deepEqual(nodeStates(home.match(/<svg class="art art--onload[\s\S]*?<\/svg>/)[0]), ['done', 'done', 'done', 'now', 'planned', 'planned', 'planned']);
});
