import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/assets/css/site.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Walks the stylesheet and returns each declaration or at-rule with the @media conditions around it.
function withContext(source) {
  const found = [];
  const stack = [];
  let buffer = '';
  for (const char of source) {
    if (char === '{') {
      const prelude = buffer.trim();
      stack.push(prelude);
      if (prelude.startsWith('@view-transition')) found.push({ text: prelude, media: stack.slice(0, -1).filter((p) => p.startsWith('@media')) });
      buffer = '';
    } else if (char === '}' || char === ';') {
      const text = buffer.trim();
      if (text) found.push({ text, media: stack.filter((p) => p.startsWith('@media')) });
      if (char === '}') stack.pop();
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return found;
}

test('all motion is switched off when someone asks for reduced motion', () => {
  const moving = withContext(css).filter(({ text }) => /^(animation|transition|scroll-behavior)\b|^@view-transition/.test(text));
  assert.ok(moving.length > 0);
  for (const { text, media } of moving) {
    assert.ok(media.some((m) => m.includes('prefers-reduced-motion: no-preference')), `Not inside a no-preference media query: ${text}`);
  }
});
