import assert from 'node:assert/strict';
import { test } from 'node:test';
import { markdownToHtml } from '../tools/lib/markdown.mjs';

const md = (text, options) => markdownToHtml(text, options).html;

test('paragraphs are split by blank lines and keep soft line breaks', () => {
  assert.equal(md('One line\nsame paragraph\n\nNew paragraph'), '<p>One line\nsame paragraph</p>\n<p>New paragraph</p>');
});

test('two trailing spaces or a backslash make a hard line break', () => {
  assert.equal(md('First  \nSecond\\\nThird'), '<p>First<br>\nSecond<br>\nThird</p>');
});

test('headings get ids and can be shifted so a post never has a second h1', () => {
  assert.equal(md('## What I learnt'), '<h2 id="what-i-learnt">What I learnt</h2>');
  assert.equal(md('# Big\n\n## Small', { topHeadingLevel: 2 }), '<h2 id="big">Big</h2>\n<h3 id="small">Small</h3>');
  assert.equal(md('# Main', { reservedIds: ['main'] }), '<h1 id="main-2">Main</h1>');
});

test('emphasis, strong and both together', () => {
  assert.equal(md('*one* _two_ **three** __four__ ***five***'), '<p><em>one</em> <em>two</em> <strong>three</strong> <strong>four</strong> <em><strong>five</strong></em></p>');
  assert.equal(md('*outer **inner** outer*'), '<p><em>outer <strong>inner</strong> outer</em></p>');
});

test('underscores inside words and lone asterisks stay as text', () => {
  assert.equal(md('snake_case_name and 3 * 4 = 12'), '<p>snake_case_name and 3 * 4 = 12</p>');
});

test('inline code keeps its contents literal', () => {
  assert.equal(md('Use `a*b*c` here'), '<p>Use <code>a*b*c</code> here</p>');
});

test('links, with titles and brackets in the address', () => {
  assert.equal(md('[Road to launch](/road-to-launch/)'), '<p><a href="/road-to-launch/">Road to launch</a></p>');
  assert.equal(md('[NSW](https://www.nsw.gov.au "NSW Government")'), '<p><a href="https://www.nsw.gov.au" title="NSW Government">NSW</a></p>');
  assert.equal(md('[wiki](https://en.wikipedia.org/wiki/Salt_(disambiguation))'), '<p><a href="https://en.wikipedia.org/wiki/Salt_(disambiguation)">wiki</a></p>');
  assert.equal(md('<https://example.com>'), '<p><a href="https://example.com">https://example.com</a></p>');
});

test('unsafe link types are shown as plain text', () => {
  assert.equal(md('[click](javascript:alert(1))'), '<p>click</p>');
  assert.equal(md('[x](data:text/html;base64,AAAA)'), '<p>x</p>');
});

test('phone links are kept, so the check can catch them', () => {
  assert.equal(md('[Ring](tel:0400000000)'), '<p><a href="tel:0400000000">Ring</a></p>');
});

test('images are collected and relative paths resolved', () => {
  const result = markdownToHtml('![A tidy switchboard](media/board.jpg "Board")', {
    resolveUrl: (url, kind) => (kind === 'image' ? `/journal/${url}` : url),
  });
  assert.equal(result.html, '<p><img src="/journal/media/board.jpg" alt="A tidy switchboard" title="Board" loading="lazy" decoding="async"></p>');
  assert.deepEqual(result.images, [{ src: '/journal/media/board.jpg', alt: 'A tidy switchboard' }]);
});

test('bulleted and numbered lists, including a start number and nesting', () => {
  assert.equal(md('- one\n- two'), '<ul>\n<li>one</li>\n<li>two</li>\n</ul>');
  assert.equal(md('3. three\n4. four'), '<ol start="3">\n<li>three</li>\n<li>four</li>\n</ol>');
  assert.equal(md('- parent\n  - child\n- next'), '<ul>\n<li>parent\n<ul>\n<li>child</li>\n</ul></li>\n<li>next</li>\n</ul>');
});

test('a blank line between items makes a loose list with paragraphs', () => {
  assert.equal(md('- one\n\n- two'), '<ul>\n<li><p>one</p></li>\n<li><p>two</p></li>\n</ul>');
});

test('a list ends at a blank line followed by a paragraph', () => {
  assert.equal(md('- one\n\nAfter'), '<ul>\n<li>one</li>\n</ul>\n<p>After</p>');
});

test('blockquotes, including lazy continuation lines', () => {
  assert.equal(md('> Salt keeps things\nfrom going bad.\n\n> Second'), '<blockquote>\n<p>Salt keeps things\nfrom going bad.</p>\n</blockquote>\n<blockquote>\n<p>Second</p>\n</blockquote>');
});

test('raw HTML is escaped, never passed through', () => {
  assert.equal(md('<script>alert(1)</script> & <b>bold</b>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;</p>');
});

test('backslash escapes and horizontal rules', () => {
  assert.equal(md('\\*not emphasis\\*'), '<p>*not emphasis*</p>');
  assert.equal(md('Above\n\n---\n\nBelow'), '<p>Above</p>\n<hr>\n<p>Below</p>');
});
