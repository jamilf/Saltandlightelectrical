// A forgiving HTML parser, enough for the check script to read the pages the build writes.
// Produces a light tree: { type: 'element', name, attrs, children, parent } and { type: 'text', value }.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW_TEXT = new Set(['script', 'style']);
const ESCAPABLE_RAW = new Set(['textarea', 'title']);
const INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'kbd', 'mark', 'q', 's',
  'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var',
]);

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', copy: '©',
};

export function decodeEntities(text) {
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED[body.toLowerCase()] ?? match;
  });
}

export function parseHtml(source) {
  const root = { type: 'root', name: '#root', attrs: {}, children: [], parent: null };
  let node = root;
  let i = 0;

  const addText = (value) => {
    if (value) node.children.push({ type: 'text', value: decodeEntities(value), parent: node });
  };

  while (i < source.length) {
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<!', i) || source.startsWith('<?', i)) {
      const end = source.indexOf('>', i);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (source.startsWith('</', i)) {
      const match = source.slice(i).match(/^<\/([a-zA-Z][\w:-]*)\s*>/);
      if (match) {
        const name = match[1].toLowerCase();
        for (let open = node; open && open !== root; open = open.parent) {
          if (open.name === name) {
            node = open.parent;
            break;
          }
        }
        i += match[0].length;
        continue;
      }
    }
    if (source[i] === '<' && /[a-zA-Z]/.test(source[i + 1] ?? '')) {
      const tag = readTag(source, i);
      if (tag) {
        const element = { type: 'element', name: tag.name, attrs: tag.attrs, children: [], parent: node };
        node.children.push(element);
        i = tag.end;
        if (RAW_TEXT.has(tag.name) || ESCAPABLE_RAW.has(tag.name)) {
          const close = source.toLowerCase().indexOf(`</${tag.name}`, i);
          const end = close === -1 ? source.length : close;
          const value = source.slice(i, end);
          if (value) {
            element.children.push({
              type: 'text',
              value: ESCAPABLE_RAW.has(tag.name) ? decodeEntities(value) : value,
              parent: element,
            });
          }
          const closeEnd = close === -1 ? source.length : source.indexOf('>', close) + 1;
          i = closeEnd;
          continue;
        }
        if (!VOID.has(tag.name) && !tag.selfClosing) node = element;
        continue;
      }
    }
    const next = source.indexOf('<', i + 1);
    const end = next === -1 ? source.length : next;
    addText(source.slice(i, end));
    i = end;
  }
  return root;
}

function readTag(source, start) {
  const nameMatch = source.slice(start).match(/^<([a-zA-Z][\w:-]*)/);
  if (!nameMatch) return null;
  const name = nameMatch[1].toLowerCase();
  const attrs = {};
  let i = start + nameMatch[0].length;
  const attrPattern = /^\s*([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/;
  while (i < source.length) {
    const rest = source.slice(i);
    const close = rest.match(/^\s*(\/?)>/);
    if (close) return { name, attrs, end: i + close[0].length, selfClosing: close[1] === '/' };
    const attr = rest.match(attrPattern);
    if (!attr) {
      i += 1;
      continue;
    }
    const value = attr[2] ?? attr[3] ?? attr[4] ?? '';
    attrs[attr[1].toLowerCase()] = decodeEntities(value);
    i += attr[0].length;
  }
  return null;
}

export function walk(node, visit) {
  if (visit(node) === false) return;
  for (const child of node.children ?? []) walk(child, visit);
}

export function findAll(node, predicate) {
  const out = [];
  walk(node, (n) => {
    if (n.type === 'element' && predicate(n)) out.push(n);
  });
  return out;
}

export function byName(node, ...names) {
  const wanted = new Set(names);
  return findAll(node, (n) => wanted.has(n.name));
}

/** Visible text of a node. Block elements are separated by spaces; skip lets the caller leave subtrees out. */
export function textOf(node, skip = () => false) {
  const parts = [];
  const visit = (n) => {
    if (n.type === 'text') {
      parts.push(n.value);
      return;
    }
    if (n.type === 'element' && (RAW_TEXT.has(n.name) || n.name === 'template' || skip(n))) return;
    const block = n.type === 'element' && !INLINE.has(n.name);
    if (block) parts.push(' ');
    for (const child of n.children) visit(child);
    if (block) parts.push(' ');
  };
  visit(node);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

export function closest(node, predicate) {
  for (let n = node; n; n = n.parent) {
    if (n.type === 'element' && predicate(n)) return n;
  }
  return null;
}
