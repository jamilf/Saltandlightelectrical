// Line drawings for the home page, in the same hand as the road to launch: blueprint strokes on
// a light sheet, no people and no text, so they need no translation and can't date. They're
// decoration (aria-hidden); the words around them carry the meaning.
//
// Strokes marked "d" draw themselves in (pathLength="1" lets site.css animate any shape the same
// way), "f" fades in and "p" pops in. dl-N sets the delay in tenths of a second. All of it is off
// under reduced motion. The hero draws on load; the others draw as they scroll into view.

const svg = (viewBox, className, body) =>
  `<svg class="art ${className}" viewBox="${viewBox}" focusable="false" aria-hidden="true">${body}</svg>`;

/**
 * The hero: a lamp on its stand, wired back to a socket. The cable carries one node per stage,
 * energised up to the current one, so the drawing always matches content/milestones.json. The
 * lamp stays unlit until live mode.
 */
export function heroArt(milestones, config) {
  const live = config.mode === 'live';
  const stages = milestones.stages.filter((stage) => !stage.isLoad);
  const found = stages.findIndex((stage) => stage.isCurrent);
  const current = live ? stages.length : Math.max(0, found);

  const [first, last] = [104, 336];
  const step = stages.length > 1 ? (last - first) / (stages.length - 1) : 0;
  const nodeX = stages.map((_, index) => Math.round(first + index * step));
  const liveEnd = live ? 372 : nodeX[current];
  const cable = (end) => `M59 344V376Q59 384 67 384H${end}`;

  const nodes = nodeX.map((x, index) => {
    const state = index < current ? 'done' : index === current ? 'now' : 'planned';
    return `<circle class="node node--${state} p dl-${Math.min(17, 11 + index)}" cx="${x}" cy="384" r="5.5"/>`;
  });

  const hatch = Array.from({ length: 20 }, (_, index) => `M${44 + index * 24} 406L${54 + index * 24} 396`).join('');

  return svg('0 56 560 372', 'art--onload art--hero', [
    '<defs><pattern id="art-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle class="art__grid" cx="10" cy="10" r="1"/></pattern></defs>',
    '<rect class="f dl-0" x="8" y="64" width="544" height="356" fill="url(#art-grid)"/>',
    '<rect class="ln ln--frame" x="8.5" y="64.5" width="543" height="355"/>',
    // Guides: the lamp's centre line and its height.
    '<path class="ln ln--guide f dl-9" d="M410 94V412"/>',
    '<path class="ln ln--dim f dl-10" d="M452 118H516M506 118V396M500 124L512 112M500 402L512 390"/>',
    // Floor, socket and lamp.
    '<path class="ln ln--soft d dl-0" pathLength="1" d="M36 396H524"/>',
    `<path class="ln ln--dim f dl-2" d="${hatch}"/>`,
    '<rect class="ln d dl-2" pathLength="1" x="44" y="300" width="30" height="44" rx="3"/>',
    '<path class="ln ln--thin d dl-3" pathLength="1" d="M54 313V323M64 313V323M59 330V334"/>',
    '<path class="ln d dl-2" pathLength="1" d="M372 396C372 383 380 376 392 376H428C440 376 448 383 448 396"/>',
    '<path class="ln d dl-3" pathLength="1" d="M410 376V200"/>',
    '<path class="ln d dl-4" pathLength="1" d="M374 118H446L476 200H344Z"/>',
    '<rect class="ln ln--thin d dl-6" pathLength="1" x="403" y="127" width="14" height="13" rx="1.5"/>',
    `<circle class="ln ln--thin d dl-6${live ? ' lit' : ''}" pathLength="1" cx="410" cy="158" r="17"/>`,
    '<path class="ln ln--thin d dl-7" pathLength="1" d="M402 160L406 153L410 160L414 153L418 160"/>',
    // The cable, then the power along it, then a node for each stage.
    `<path class="ln ln--dead d dl-4" pathLength="1" d="${cable(372)}"/>`,
    `<path class="ln ln--live d dl-18" pathLength="1" d="${cable(liveEnd)}"/>`,
    ...nodes,
  ].join(''));
}

/** Why the name: a salt crystal's lattice, and a lamp on its stand (Matthew 5:13-16). */
export function nameArt() {
  const corners = [
    [30, 80, 'done'], [120, 80, 'open'], [120, 170, 'done'], [30, 170, 'open'],
    [66, 44, 'open'], [156, 44, 'done'], [156, 134, 'open'], [66, 134, 'done'],
  ];
  return svg('0 0 360 200', 'art--onview', [
    '<path class="ln ln--thin d dl-0" pathLength="1" d="M66 44H156V134H66Z"/>',
    '<path class="ln ln--thin d dl-1" pathLength="1" d="M30 80L66 44M120 80L156 44M120 170L156 134M30 170L66 134"/>',
    '<path class="ln d dl-2" pathLength="1" d="M30 80H120V170H30Z"/>',
    ...corners.map(([x, y, state], index) => `<circle class="node node--${state === 'done' ? 'done' : 'planned'} p dl-${4 + index}" cx="${x}" cy="${y}" r="7"/>`),
    // A clay oil lamp on its stand, with its flame at the spout.
    '<path class="ln ln--soft d dl-3" pathLength="1" d="M200 190H352"/>',
    '<path class="ln d dl-4" pathLength="1" d="M236 190L250 176H300L314 190"/>',
    '<path class="ln d dl-5" pathLength="1" d="M275 176V104M266 142H284"/>',
    '<path class="ln d dl-6" pathLength="1" d="M240 104H310M246 104Q275 117 304 104"/>',
    '<path class="ln d dl-7" pathLength="1" d="M248 104C243 86 254 70 277 70C293 70 305 75 314 81L333 76C342 76 343 89 334 90L312 97C309 101 303 104 295 104Z"/>',
    '<path class="ln ln--thin d dl-8" pathLength="1" d="M248 93C235 93 231 78 240 74C245 72 250 76 251 81M268 75C271 72 283 72 286 75"/>',
    '<path class="ln d dl-10" pathLength="1" d="M335 79C327 70 330 54 339 40C348 54 350 70 342 79Z"/>',
  ].join(''));
}

/** First promise, doing the work once and properly: a conduit run, saddled at even spacings. */
export function workArt() {
  const saddles = [50, 110, 170].map((x, index) =>
    `<path class="ln d dl-${4 + index}" pathLength="1" d="M${x - 13} 90H${x - 7}V65H${x + 7}V90H${x + 13}"/>`);
  return svg('0 0 300 150', 'art--onview', [
    '<path class="ln d dl-0" pathLength="1" d="M20 70H214A26 26 0 0 0 240 44V14"/>',
    '<path class="ln d dl-1" pathLength="1" d="M20 84H214A40 40 0 0 0 254 44V14"/>',
    '<path class="ln ln--thin d dl-2" pathLength="1" d="M20 70V84M240 14H254"/>',
    ...saddles,
    '<path class="ln ln--dim f dl-8" d="M50 98V124M110 98V124M170 98V124M50 118H170M46 122L54 114M106 122L114 114M166 122L174 114"/>',
  ].join(''));
}

/** Second promise, clear records: a switchboard with every circuit labelled, and its schedule. */
export function recordsArt() {
  const breakers = [32, 54, 76, 98, 120].map((x, index) =>
    `<rect class="ln ln--thin d dl-${3 + index}" pathLength="1" x="${x}" y="34" width="16" height="30" rx="1.5"/>` +
    `<rect class="ln ln--thin d dl-${3 + index}" pathLength="1" x="${x + 5}" y="43" width="6" height="9" rx="1"/>` +
    `<rect class="ln ln--thin d dl-${6 + index}" pathLength="1" x="${x}" y="72" width="16" height="8" rx="1"/>`);
  const rows = [262, 248, 256, 238, 250].map((end, index) => {
    const y = 58 + index * 14;
    return `<circle class="node node--done p dl-${9 + index}" cx="186" cy="${y}" r="2.5"/><path class="ln ln--thin d dl-${9 + index}" pathLength="1" d="M196 ${y}H${end}"/>`;
  });
  return svg('0 0 300 150', 'art--onview', [
    '<rect class="ln d dl-0" pathLength="1" x="20" y="14" width="130" height="122" rx="2"/>',
    '<path class="ln ln--thin d dl-2" pathLength="1" d="M26 49H32M48 49H54M70 49H76M92 49H98M114 49H120M136 49H144"/>',
    ...breakers,
    '<rect class="ln d dl-6" pathLength="1" x="172" y="22" width="108" height="108" rx="2"/>',
    '<path class="ln d dl-8" pathLength="1" d="M182 40H270"/>',
    ...rows,
  ].join(''));
}
