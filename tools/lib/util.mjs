// Small helpers shared by build, check and tests. Built-in modules only.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export class SiteError extends Error {
  constructor(problems, heading = 'Build stopped') {
    const list = Array.isArray(problems) ? problems : [problems];
    super(`${heading}:\n${list.map((p) => `  - ${p}`).join('\n')}`);
    this.problems = list;
  }
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function readText(path) {
  return readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function readJson(path) {
  let text;
  try {
    text = readText(path);
  } catch {
    throw new SiteError(`Can't read ${path}. Check the file exists.`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new SiteError(`${path} isn't valid JSON (${error.message}). Look for a missing comma or quote.`);
  }
}

// Every file under dir, as paths relative to dir, sorted so output order never changes.
export function walkFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkFiles(full, base));
    else out.push(full.slice(base.length + 1).split('\\').join('/'));
  }
  return out;
}

// Plain text for comparing and matching: straight apostrophes and quotes, single spaces.
export function normalizeText(value) {
  return String(value)
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u00A0\s]+/g, ' ')
    .trim();
}

export function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isYearMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// "2026-09-26" becomes "26 September 2026". Done by hand so it never depends on locale data.
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function rfc822(iso) {
  return new Date(`${iso}T00:00:00Z`).toUTCString();
}

export function shortHash(content) {
  return createHash('sha256').update(content).digest('hex').slice(0, 10);
}

export const PLACEHOLDER_PATTERN = /\[\[[^\]\n]*\]\]/g;

export function fillTokens(text, values) {
  return String(text).replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

export function wordCount(text) {
  const words = normalizeText(text).match(/[A-Za-z0-9'’-]+/g);
  return words ? words.length : 0;
}
