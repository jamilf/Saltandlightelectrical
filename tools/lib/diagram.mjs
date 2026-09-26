// The road to launch as a single-line diagram, generated from content/milestones.json.
// It is an ordered list first: each stage is a list item with its reference, name, timing and
// state in plain text. The wires and switch symbols are decoration on top (aria-hidden), so the
// diagram reads the same to a screen reader and with CSS turned off.
//
// Done stages are closed contacts, the current stage is a contact closing (amber), planned stages
// are open contacts, and the load at the end is a lamp that stays unlit until live mode.
import { escapeHtml as e, formatDate } from './util.mjs';

const SYMBOLS = {
  closed: '<circle cx="5" cy="24" r="3.5"/><line x1="8.5" y1="24" x2="39.5" y2="24"/><circle cx="43" cy="24" r="3.5"/>',
  closing: '<circle cx="5" cy="24" r="3.5"/><line x1="8.5" y1="24" x2="39.2" y2="15.6"/><circle cx="43" cy="24" r="3.5"/>',
  open: '<circle cx="5" cy="24" r="3.5"/><line x1="8.5" y1="24" x2="36.5" y2="8.5"/><circle cx="43" cy="24" r="3.5"/>',
  lamp: '<line x1="0" y1="24" x2="11" y2="24"/><circle cx="24" cy="24" r="13"/><line x1="14.8" y1="14.8" x2="33.2" y2="33.2"/><line x1="33.2" y1="14.8" x2="14.8" y2="33.2"/>',
  gap: '<line x1="0" y1="24" x2="18" y2="24"/><line x1="30" y1="24" x2="48" y2="24"/><line x1="15" y1="32" x2="21" y2="16"/><line x1="27" y1="32" x2="33" y2="16"/>',
};

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const count = (n, noun) => `${n < 10 ? NUMBER_WORDS[n] : n} ${noun}${n === 1 ? '' : 's'}`;

export function symbolSvg(kind, size = 48, extraClass = '') {
  return `<svg class="sld__symbol sld__symbol--${kind}${extraClass ? ` ${extraClass}` : ''}" viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" focusable="false" aria-hidden="true">${SYMBOLS[kind]}</svg>`;
}

/**
 * @param {object} milestones  from loadMilestones
 * @param {object} config      from loadConfig
 * @param {{ variant?: 'full' | 'compact', link?: boolean }} [options]
 */
export function renderDiagram(milestones, config, options = {}) {
  const compact = options.variant === 'compact';
  const live = config.mode === 'live';
  const stages = milestones.stages;
  const currentIndex = stages.findIndex((stage) => stage.isCurrent);
  // The energised path runs up to the current contact, or all the way to the lamp in live mode.
  const frontier = currentIndex === -1 ? stages.length - 1 : currentIndex;

  // One second for the whole path, split into half-stages (each stage has a wire in and a wire out).
  const desktopHalf = halfStep(2 * frontier + 1);
  const timing = (half, step) => ({ delay: half * step, duration: step });

  const items = [];

  // Compact, narrow screens: every done stage collapses into one closed contact.
  const done = milestones.done;
  const collapses = compact && currentIndex > 0;
  const mobileHalf = halfStep(3);
  if (collapses) {
    const refs = done.length === 1 ? done[0].ref : `${done[0].ref} to ${done[done.length - 1].ref}`;
    items.push(item({
      classes: ['is-done', 'is-origin', 'sld__stage--summary'],
      symbol: 'closed',
      ref: refs,
      title: `${count(done.length, 'stage')} done`,
      state: 'Done',
      wireIn: { mobile: timing(0, mobileHalf) },
      wireOut: { mobile: timing(1, mobileHalf) },
    }));
  }

  const afterNext = compact && milestones.next
    ? stages.filter((stage) => stage.isPlanned && !stage.isLoad && stage.number > milestones.next.number)
    : [];

  stages.forEach((stage, index) => {
    if (stage.isLoad && afterNext.length) {
      items.push(item({
        classes: ['sld__stage--gap'],
        symbol: 'gap',
        ref: afterNext.length === 1 ? afterNext[0].ref : `${afterNext[0].ref} to ${afterNext[afterNext.length - 1].ref}`,
        title: `${count(afterNext.length, 'more stage')}`,
        state: 'Planned',
      }));
    }

    const classes = [stage.isLoad ? 'is-load' : `is-${stage.status}`];
    if (index === 0) classes.push('is-origin');
    if (stage.isLoad && live) classes.push('is-lit');
    if (compact && (stage.isDone || (stage.isPlanned && !stage.isLoad && stage !== milestones.next))) classes.push('sld__stage--collapsible');

    const energisedIn = index <= frontier;
    const energisedOut = index < frontier;
    const wireIn = energisedIn ? { desktop: timing(2 * index, desktopHalf) } : null;
    if (wireIn && collapses && index === currentIndex) wireIn.mobile = timing(2, mobileHalf);

    const title = stage.isLoad ? `${stage.title}, ${lowerFirst(stage.when)}` : stage.short;
    items.push(item({
      classes,
      symbol: stage.isLoad ? 'lamp' : stage.isDone ? 'closed' : stage.isCurrent ? 'closing' : 'open',
      ref: stage.ref,
      title,
      when: compact || stage.isLoad ? null : stage.when,
      state: stateLabel(stage, live),
      wireIn,
      wireOut: energisedOut ? { desktop: timing(2 * index + 1, desktopHalf) } : null,
      hasOut: !stage.isLoad,
    }));
  });

  const latest = milestones.latest;
  const titleBlock = compact
    ? [['Drawing', milestones.drawing.number], ['Revision', latest.rev], ['Last updated', formatDate(latest.date)]]
    : [
        ['Drawing', milestones.drawing.number],
        ['Title', milestones.drawing.title],
        ['Revision', latest.rev],
        ['Status', live ? 'Trading' : 'Not trading'],
        ['Last updated', formatDate(latest.date)],
        ['Drawn by', config.person.drawnBy],
      ];

  const legend = [
    ['closed', 'Done'],
    ['closing', 'Now'],
    ['open', 'Planned'],
    ['lamp', live ? 'The business, open' : 'The business, unlit until it opens'],
  ];

  return [
    `<section class="sld sld--${compact ? 'compact' : 'full'}" aria-label="${compact ? 'Road to launch at a glance' : 'Road to launch'}, drawing ${e(milestones.drawing.number)}">`,
    '<div class="sld__sheet">',
    `<ol class="sld__stages">\n${items.join('\n')}\n</ol>`,
    '<div class="sld__footer">',
    '<div class="sld__key">',
    `<ul class="sld__legend" aria-label="Legend">\n${legend.map(([kind, label]) => `<li>${symbolSvg(kind, 28, `is-${kind}`)}<span>${e(label)}</span></li>`).join('\n')}\n</ul>`,
    options.link ? '<p class="sld__more"><a href="/road-to-launch/">See the full road to launch</a></p>' : '',
    '</div>',
    `<dl class="title-block">\n${titleBlock.map(([term, value]) => `<div><dt>${e(term)}</dt><dd>${e(value)}</dd></div>`).join('\n')}\n</dl>`,
    '</div>',
    '</div>',
    '</section>',
  ].filter(Boolean).join('\n');
}

function item({ classes, symbol, ref, title, when = null, state, wireIn = null, wireOut = null, hasOut = true }) {
  // The collapsed summary and gap items only exist for narrow screens. The hidden attribute keeps
  // them out of the page with CSS off; site.css shows them on narrow screens.
  const narrowOnly = classes.includes('sld__stage--summary') || classes.includes('sld__stage--gap');
  return [
    `<li class="sld__stage ${classes.join(' ')}"${narrowOnly ? ' hidden' : ''}>`,
    `<div class="sld__line" aria-hidden="true">${wire('in', wireIn)}${symbolSvg(symbol, 48, timingClasses(wireIn))}${hasOut ? wire('out', wireOut) : ''}</div>`,
    '<div class="sld__label">',
    `<p class="sld__ref">${e(ref)}</p>`,
    `<p class="sld__title">${e(title)}</p>`,
    when ? `<p class="sld__when">${e(when)}</p>` : '',
    `<p class="sld__state">${e(state)}</p>`,
    '</div>',
    '</li>',
  ].filter(Boolean).join('\n');
}

function wire(side, timing) {
  if (!timing) return `<span class="sld__wire sld__wire--${side}"></span>`;
  return `<span class="sld__wire sld__wire--${side}"><span class="sld__live ${timingClasses(timing)}"></span></span>`;
}

// Timing is written as classes (dl-3 means a 300ms delay) because the content security policy
// blocks inline styles. site.css defines dl-0 to dl-20 and du-1 to du-5. A symbol gets the same
// classes as the wire leading into it, so its contact closes as the power arrives.
function timingClasses(timing) {
  if (!timing) return '';
  const classes = [];
  if (timing.desktop) classes.push(`dl-${timing.desktop.delay}`, `du-${timing.desktop.duration}`);
  if (timing.mobile) classes.push(`mdl-${timing.mobile.delay}`, `mdu-${timing.mobile.duration}`);
  return classes.join(' ');
}

/** Length of each half-stage in tenths of a second, so the whole path takes about one second. */
function halfStep(halves) {
  return Math.min(5, Math.max(1, Math.round(10 / halves)));
}

function stateLabel(stage, live) {
  if (stage.isLoad) return live ? 'Open' : 'Planned';
  return { done: 'Done', current: 'Now', planned: 'Planned' }[stage.status];
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
