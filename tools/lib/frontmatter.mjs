// Front matter: a block of `key: value` lines between two `---` lines at the top of a file.
// Deliberately small. Values are strings, true, false or empty. Quote a value that contains " #".
import { SiteError } from './util.mjs';

export function parseFrontMatter(source, file = 'file') {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return { data: {}, body: text };

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) {
    throw new SiteError(`${file}: the front matter starts with --- but never closes. Add a line with just --- after the last setting.`);
  }

  const data = {};
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) {
      throw new SiteError(`${file}, line ${index + 1}: "${line.trim()}" should look like "name: value".`);
    }
    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      throw new SiteError(`${file}, line ${index + 1}: "${key}" is set twice. Keep one.`);
    }
    data[key] = parseValue(rawValue, `${file}, line ${index + 1}`);
  }

  const body = lines.slice(end + 1).join('\n').replace(/^\n+/, '');
  return { data, body };
}

function parseValue(raw, where) {
  const value = raw.trim();
  const double = value.match(/^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/);
  if (double) return double[1].replace(/\\(["\\])/g, '$1');
  const single = value.match(/^'((?:[^']|'')*)'\s*(?:#.*)?$/);
  if (single) return single[1].replace(/''/g, "'");
  if (value.startsWith('"') || value.startsWith("'")) {
    throw new SiteError(`${where}: a quoted value isn't closed. Add the closing quote.`);
  }
  const plain = value.replace(/\s+#.*$/, '').trim();
  if (plain === '' || plain === '~' || plain === 'null') return null;
  if (plain === 'true') return true;
  if (plain === 'false') return false;
  return plain;
}
