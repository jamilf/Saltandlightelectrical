import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFrontMatter } from '../tools/lib/frontmatter.mjs';
import { render } from '../tools/lib/template.mjs';

test('front matter: strings, booleans, quotes, comments and the body', () => {
  const { data, body } = parseFrontMatter([
    '---',
    'title: Why I\'m building a business six years early',
    'date: 2026-10-12   # the day it goes up',
    'draft: true',
    'summary: "Quoted, with a # inside"',
    "note: 'It''s fine'",
    '# a whole-line comment',
    'stage:',
    '---',
    '',
    'Body text.',
  ].join('\n'));
  assert.deepEqual(data, {
    title: "Why I'm building a business six years early",
    date: '2026-10-12',
    draft: true,
    summary: 'Quoted, with a # inside',
    note: "It's fine",
    stage: null,
  });
  assert.equal(body, 'Body text.');
});

test('front matter: a file without it is all body', () => {
  assert.deepEqual(parseFrontMatter('Just text'), { data: {}, body: 'Just text' });
});

test('front matter: clear errors for an unclosed block, a repeated key and a bad line', () => {
  assert.throws(() => parseFrontMatter('---\ntitle: x\n'), /never closes/);
  assert.throws(() => parseFrontMatter('---\ntitle: a\ntitle: b\n---\n'), /set twice/);
  assert.throws(() => parseFrontMatter('---\njust words\n---\n'), /should look like/);
});

test('template: escaped values, raw values and partials', () => {
  const html = render('<p>{{ name }}</p>{{{ block }}}{{> greeting }}', { name: '<Jamil & co>', block: '<b>ok</b>', who: 'you' }, {
    partials: { greeting: '<i>Hello {{ who }}</i>' },
  });
  assert.equal(html, '<p>&lt;Jamil &amp; co&gt;</p><b>ok</b><i>Hello you</i>');
});

test('template: if, else, unless and each', () => {
  const source = '{{#if on}}yes{{else}}no{{/if}} {{#unless on}}off{{/unless}} {{#each items}}{{ @index }}:{{ label }}{{#if @last}}.{{else}},{{/if}}{{/each}}';
  assert.equal(render(source, { on: false, items: [{ label: 'a' }, { label: 'b' }] }), 'no off 0:a,1:b.');
  assert.equal(render('{{#if list}}has{{else}}empty{{/if}}', { list: [] }), 'empty');
});

test('template: outer values are visible inside each', () => {
  assert.equal(render('{{#each items}}{{ this }}{{ suffix }} {{/each}}', { items: ['a', 'b'], suffix: '!' }), 'a! b! ');
});

test('template: a missing value or partial stops the build', () => {
  assert.throws(() => render('{{ nope }}', {}), /has no value/);
  assert.throws(() => render('{{ site.nope }}', { site: {} }), /has no value/);
  assert.throws(() => render('{{> missing }}', {}), /doesn't exist/);
  assert.throws(() => render('{{#if a}}open', {}), /never closed/);
});
