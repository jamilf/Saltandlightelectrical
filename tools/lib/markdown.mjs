// A small Markdown converter for journal posts. It covers paragraphs, headings, lists,
// links, emphasis, images, blockquotes, inline code and rules. Raw HTML is shown as text,
// never passed through, so a post can't inject markup or scripts.
import { escapeHtml, slugify } from './util.mjs';

const HEADING = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const BULLET = /^( {0,3})([-*+])[ \t]+(.*)$/;
const NUMBERED = /^( {0,3})(\d{1,9})[.)][ \t]+(.*)$/;
const HARD_BREAK = '\u0000';
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'sms']);
const ESCAPABLE = '\\`*_{}[]()#+-.!>|~"\'';

/**
 * @param {string} markdown
 * @param {{ topHeadingLevel?: number, reservedIds?: string[], resolveUrl?: (url: string, kind: 'link' | 'image') => string }} [options]
 */
export function markdownToHtml(markdown, options = {}) {
  const lines = String(markdown)
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\t/g, '    ')
    .split('\n');

  const state = {
    images: [],
    ids: new Set(options.reservedIds ?? []),
    headingShift: 0,
    resolveUrl: options.resolveUrl ?? ((url) => url),
  };

  if (options.topHeadingLevel) {
    const levels = lines.map((line) => line.match(HEADING)).filter(Boolean).map((m) => m[1].length);
    if (levels.length) state.headingShift = options.topHeadingLevel - Math.min(...levels);
  }

  return { html: parseBlocks(lines, state).join('\n'), images: state.images };
}

function isBlockStart(line) {
  return HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || BULLET.test(line) || NUMBERED.test(line);
}

function parseBlocks(lines, state) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      out.push(renderHeading(heading, state));
      i += 1;
      continue;
    }

    if (RULE.test(line)) {
      out.push('<hr>');
      i += 1;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner = [];
      while (i < lines.length) {
        const quoted = lines[i].match(QUOTE);
        if (quoted) {
          inner.push(quoted[1]);
        } else if (lines[i].trim() && inner.length && inner[inner.length - 1].trim() && !isBlockStart(lines[i])) {
          inner.push(lines[i]);
        } else {
          break;
        }
        i += 1;
      }
      out.push(`<blockquote>\n${parseBlocks(inner, state).join('\n')}\n</blockquote>`);
      continue;
    }

    if (BULLET.test(line) || NUMBERED.test(line)) {
      const list = parseList(lines, i, state);
      out.push(list.html);
      i = list.next;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !(paragraph.length && isBlockStart(lines[i]))) {
      paragraph.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${parseInline(joinLines(paragraph), state)}</p>`);
  }
  return out;
}

function joinLines(lines) {
  return lines
    .map((line, index) => {
      const last = index === lines.length - 1;
      if (!last && / {2,}$/.test(line)) return line.trim() + HARD_BREAK;
      if (!last && /\\$/.test(line.trimEnd())) return line.trimEnd().slice(0, -1).trim() + HARD_BREAK;
      return line.trim();
    })
    .join('\n');
}

function renderHeading(match, state) {
  const level = Math.min(6, Math.max(1, match[1].length + state.headingShift));
  const inner = parseInline(match[2], state);
  const base = slugify(inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'")) || 'section';
  let id = base;
  for (let n = 2; state.ids.has(id); n += 1) id = `${base}-${n}`;
  state.ids.add(id);
  return `<h${level} id="${id}">${inner}</h${level}>`;
}

function parseList(lines, start, state) {
  const ordered = NUMBERED.test(lines[start]);
  const marker = ordered ? NUMBERED : BULLET;
  const items = [];
  let loose = false;
  let first;
  let i = start;

  while (i < lines.length) {
    const match = lines[i].match(marker);
    if (!match) break;
    const content = match[3];
    const contentColumn = match[0].length - content.length;
    const indent = match[1].length;
    if (ordered && first === undefined) first = Number(match[2]);

    const itemLines = [content];
    i += 1;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        let j = i;
        while (j < lines.length && !lines[j].trim()) j += 1;
        if (j >= lines.length) {
          i = j;
          break;
        }
        const nextIndent = lines[j].match(/^ */)[0].length;
        if (nextIndent >= contentColumn) {
          loose = true;
          itemLines.push('');
          i += 1;
          continue;
        }
        if (marker.test(lines[j]) && nextIndent <= indent + 3) {
          loose = true;
          i = j;
        }
        break;
      }
      const lineIndent = line.match(/^ */)[0].length;
      if (lineIndent >= contentColumn) {
        itemLines.push(line.slice(contentColumn));
        i += 1;
        continue;
      }
      if (BULLET.test(line) || NUMBERED.test(line) || isBlockStart(line)) break;
      itemLines.push(line.trim());
      i += 1;
    }
    items.push(itemLines);
    if (i < lines.length && !lines[i].trim()) break;
  }

  const body = items
    .map((itemLines) => {
      const blocks = parseBlocks(itemLines, state).map((block) =>
        !loose && block.startsWith('<p>') && block.endsWith('</p>') ? block.slice(3, -4) : block,
      );
      return `<li>${blocks.join('\n')}</li>`;
    })
    .join('\n');

  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && first !== 1 ? ` start="${first}"` : '';
  return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, next: i };
}

const SPECIAL = /[\u0000\\`![<*_]/;

function parseInline(text, state) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const nextSpecial = rest.search(SPECIAL);
    if (nextSpecial === -1) {
      out += escapeHtml(rest);
      break;
    }
    if (nextSpecial > 0) {
      out += escapeHtml(rest.slice(0, nextSpecial));
      i += nextSpecial;
      continue;
    }

    const ch = text[i];
    if (ch === HARD_BREAK) {
      out += '<br>';
      i += 1;
      continue;
    }
    if (ch === '\\' && i + 1 < text.length && ESCAPABLE.includes(text[i + 1])) {
      out += escapeHtml(text[i + 1]);
      i += 2;
      continue;
    }
    if (ch === '`') {
      const run = rest.match(/^`+/)[0];
      const close = text.indexOf(run, i + run.length);
      if (close !== -1) {
        out += `<code>${escapeHtml(text.slice(i + run.length, close).trim())}</code>`;
        i = close + run.length;
      } else {
        out += escapeHtml(run);
        i += run.length;
      }
      continue;
    }
    if (ch === '!' && text[i + 1] === '[') {
      const link = parseLinkAt(text, i + 1);
      if (link) {
        out += renderImage(link, state);
        i = link.end;
        continue;
      }
    }
    if (ch === '[') {
      const link = parseLinkAt(text, i);
      if (link) {
        out += renderLink(link, state);
        i = link.end;
        continue;
      }
    }
    if (ch === '<') {
      const auto = rest.match(/^<((?:https?:\/\/|mailto:)[^\s<>]+)>/i);
      if (auto) {
        out += `<a href="${escapeHtml(auto[1])}">${escapeHtml(auto[1].replace(/^mailto:/i, ''))}</a>`;
        i += auto[0].length;
        continue;
      }
    }
    if (ch === '*' || ch === '_') {
      const emphasis = parseEmphasis(text, i, state);
      if (emphasis) {
        out += emphasis.html;
        i = emphasis.end;
        continue;
      }
      const run = rest.match(ch === '*' ? /^\*+/ : /^_+/)[0];
      out += escapeHtml(run);
      i += run.length;
      continue;
    }
    out += escapeHtml(ch);
    i += 1;
  }
  return out;
}

function parseLinkAt(text, start) {
  let depth = 0;
  let j = start;
  for (; j < text.length; j += 1) {
    const c = text[j];
    if (c === '\\') {
      j += 1;
      continue;
    }
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  if (j >= text.length || text[j + 1] !== '(') return null;
  const label = text.slice(start + 1, j);

  let k = j + 2;
  while (text[k] === ' ') k += 1;
  let url;
  if (text[k] === '<') {
    const close = text.indexOf('>', k);
    if (close === -1) return null;
    url = text.slice(k + 1, close);
    k = close + 1;
  } else {
    const begin = k;
    let parens = 0;
    for (; k < text.length; k += 1) {
      const c = text[k];
      if (c === '\\') {
        k += 1;
        continue;
      }
      if (c === '(') parens += 1;
      else if (c === ')') {
        if (parens === 0) break;
        parens -= 1;
      } else if (c === ' ') break;
    }
    url = text.slice(begin, k);
  }

  while (text[k] === ' ') k += 1;
  let title = null;
  if (text[k] === '"' || text[k] === "'") {
    const close = text.indexOf(text[k], k + 1);
    if (close === -1) return null;
    title = text.slice(k + 1, close);
    k = close + 1;
    while (text[k] === ' ') k += 1;
  }
  if (text[k] !== ')') return null;
  return { label, url: url.replace(/\\(.)/g, '$1'), title, end: k + 1 };
}

function safeUrl(url) {
  const clean = String(url).replace(/[\u0000-\u001F\u007F\s]+/g, '');
  const scheme = clean.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !SAFE_SCHEMES.has(scheme[1].toLowerCase())) return null;
  return clean;
}

function renderLink(link, state) {
  const label = parseInline(link.label, state);
  const url = safeUrl(link.url);
  if (!url) return label;
  const title = link.title ? ` title="${escapeHtml(link.title)}"` : '';
  return `<a href="${escapeHtml(state.resolveUrl(url, 'link'))}"${title}>${label}</a>`;
}

function renderImage(link, state) {
  const alt = link.label.replace(/\\(.)/g, '$1').replace(/[*_`]/g, '').trim();
  const url = safeUrl(link.url);
  if (!url) return escapeHtml(alt);
  const src = state.resolveUrl(url, 'image');
  state.images.push({ src, alt });
  const title = link.title ? ` title="${escapeHtml(link.title)}"` : '';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${title} loading="lazy" decoding="async">`;
}

function parseEmphasis(text, i, state) {
  const ch = text[i];
  const run = text.slice(i).match(ch === '*' ? /^\*+/ : /^_+/)[0];
  if (ch === '_' && i > 0 && /[A-Za-z0-9]/.test(text[i - 1])) return null;

  for (const size of [3, 2, 1].filter((n) => n <= run.length)) {
    const openEnd = i + size;
    if (!text[openEnd] || /\s/.test(text[openEnd])) continue;
    const close = findClose(text, openEnd, ch, size);
    if (close === -1) continue;
    const inner = parseInline(text.slice(openEnd, close), state);
    const html =
      size === 3 ? `<em><strong>${inner}</strong></em>` : size === 2 ? `<strong>${inner}</strong>` : `<em>${inner}</em>`;
    return { html, end: close + size };
  }
  return null;
}

function findClose(text, from, ch, size) {
  let k = from;
  while (k < text.length) {
    const c = text[k];
    if (c === '\\') {
      k += 2;
      continue;
    }
    if (c === '`') {
      const run = text.slice(k).match(/^`+/)[0];
      const close = text.indexOf(run, k + run.length);
      k = close === -1 ? k + run.length : close + run.length;
      continue;
    }
    if (c === ch) {
      const run = text.slice(k).match(ch === '*' ? /^\*+/ : /^_+/)[0];
      const after = text[k + run.length] ?? '';
      const closes =
        run.length === size &&
        k > from &&
        !/\s/.test(text[k - 1]) &&
        !(ch === '_' && /[A-Za-z0-9]/.test(after));
      if (closes) return k;
      k += run.length;
      continue;
    }
    k += 1;
  }
  return -1;
}
