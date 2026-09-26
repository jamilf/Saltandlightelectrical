// A tiny template language for pages, layouts and partials.
//   {{ value.path }}      escaped text
//   {{{ value.path }}}    trusted HTML made by the build (never user input)
//   {{> partial-name }}   another file from src/partials
//   {{#if path}} ... {{else}} ... {{/if}}, {{#unless path}} ... {{/unless}}
//   {{#each list}} {{ this.label }} {{ @index }} {{/each}}
//   {{! a comment }}
// Using a value that doesn't exist stops the build, so typos can't ship.
import { SiteError, escapeHtml } from './util.mjs';

const TAG = /\{\{\{\s*([^}]+?)\s*\}\}\}|\{\{\s*([^}]+?)\s*\}\}/g;
const BLOCKS = new Set(['if', 'unless', 'each']);

export function compile(source, name = 'template') {
  const root = { type: 'root', children: [] };
  const stack = [root];
  let last = 0;

  const current = () => {
    const node = stack[stack.length - 1];
    return node.inElse ? node.otherwise : node.children;
  };

  for (const match of source.matchAll(TAG)) {
    if (match.index > last) current().push({ type: 'text', value: source.slice(last, match.index) });
    last = match.index + match[0].length;

    if (match[1] !== undefined) {
      current().push({ type: 'raw', path: match[1].trim() });
      continue;
    }

    const tag = match[2].trim();
    if (tag.startsWith('!')) continue;
    if (tag.startsWith('>')) {
      current().push({ type: 'partial', name: tag.slice(1).trim() });
      continue;
    }
    if (tag.startsWith('#')) {
      const [keyword, path] = tag.slice(1).split(/\s+/, 2);
      if (!BLOCKS.has(keyword) || !path) throw new SiteError(`${name}: "{{${tag}}}" isn't a block this template language knows.`);
      const node = { type: keyword, path, children: [], otherwise: [], inElse: false };
      current().push(node);
      stack.push(node);
      continue;
    }
    if (tag === 'else') {
      const node = stack[stack.length - 1];
      if (node.type !== 'if' && node.type !== 'unless') throw new SiteError(`${name}: {{else}} is outside an if block.`);
      node.inElse = true;
      continue;
    }
    if (tag.startsWith('/')) {
      const keyword = tag.slice(1).trim();
      const node = stack.pop();
      if (!node || node.type !== keyword) throw new SiteError(`${name}: {{/${keyword}}} doesn't match the block it closes.`);
      continue;
    }
    current().push({ type: 'value', path: tag });
  }

  if (stack.length > 1) throw new SiteError(`${name}: {{#${stack[stack.length - 1].type}}} is never closed.`);
  if (last < source.length) root.children.push({ type: 'text', value: source.slice(last) });
  return { name, children: root.children };
}

/**
 * @param {string} source
 * @param {object} context
 * @param {{ name?: string, partials?: Record<string, string> }} [options]
 */
export function render(source, context, options = {}) {
  const env = { partials: options.partials ?? {}, cache: new Map(), depth: 0 };
  const scope = { values: context, parent: null };
  return renderNodes(compile(source, options.name).children, scope, env, options.name ?? 'template');
}

function renderNodes(nodes, scope, env, name) {
  let out = '';
  for (const node of nodes) {
    switch (node.type) {
      case 'text':
        out += node.value;
        break;
      case 'value': {
        const value = lookup(scope, node.path, name, true);
        out += value === null ? '' : escapeHtml(value);
        break;
      }
      case 'raw': {
        const value = lookup(scope, node.path, name, true);
        out += value === null ? '' : String(value);
        break;
      }
      case 'partial':
        out += renderPartial(node.name, scope, env);
        break;
      case 'if':
      case 'unless': {
        const truthy = isTruthy(lookup(scope, node.path, name, false));
        const branch = (node.type === 'if' ? truthy : !truthy) ? node.children : node.otherwise;
        out += renderNodes(branch, scope, env, name);
        break;
      }
      case 'each': {
        const list = lookup(scope, node.path, name, false);
        if (list == null) break;
        if (!Array.isArray(list)) throw new SiteError(`${name}: {{#each ${node.path}}} needs a list.`);
        list.forEach((item, index) => {
          const values = {
            ...(item && typeof item === 'object' ? item : {}),
            this: item,
            '@index': index,
            '@first': index === 0,
            '@last': index === list.length - 1,
          };
          out += renderNodes(node.children, { values, parent: scope }, env, name);
        });
        break;
      }
      default:
        throw new SiteError(`${name}: unknown template node ${node.type}.`);
    }
  }
  return out;
}

function renderPartial(partialName, scope, env) {
  if (!Object.prototype.hasOwnProperty.call(env.partials, partialName)) {
    throw new SiteError(`Partial "${partialName}" doesn't exist. Add src/partials/${partialName}.html or fix the name.`);
  }
  if (env.depth > 20) throw new SiteError(`Partial "${partialName}" includes itself too many times.`);
  if (!env.cache.has(partialName)) env.cache.set(partialName, compile(env.partials[partialName], `partial ${partialName}`));
  env.depth += 1;
  const html = renderNodes(env.cache.get(partialName).children, scope, env, `partial ${partialName}`);
  env.depth -= 1;
  return html;
}

function lookup(scope, path, name, required) {
  const [head, ...rest] = path.split('.');
  for (let s = scope; s; s = s.parent) {
    if (s.values && typeof s.values === 'object' && head in s.values) {
      let value = s.values[head];
      for (const key of rest) {
        if (value == null || !(key in Object(value))) {
          if (required) throw new SiteError(`${name}: "{{ ${path} }}" has no value. Check the spelling or the data.`);
          return undefined;
        }
        value = value[key];
      }
      if (value === undefined && required) {
        throw new SiteError(`${name}: "{{ ${path} }}" has no value. Check the spelling or the data.`);
      }
      return value;
    }
  }
  if (required) throw new SiteError(`${name}: "{{ ${path} }}" has no value. Check the spelling or the data.`);
  return undefined;
}

function isTruthy(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}
