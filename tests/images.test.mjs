import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { imageSize } from '../tools/lib/util.mjs';

const dir = mkdtempSync(join(tmpdir(), 'sle-images-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const file = (name, content) => {
  writeFileSync(join(dir, name), content);
  return join(dir, name);
};

test('image sizes are read from PNG, JPEG and SVG files', () => {
  const png = Buffer.alloc(24);
  png.writeUInt32BE(300, 16);
  png.writeUInt32BE(200, 20);
  assert.deepEqual(imageSize(file('a.png', png)), { width: 300, height: 200 });

  // A JPEG with an APP0 segment, then the frame header that holds the size (height 300, width 400).
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x90, ...Array(12).fill(0)]);
  assert.deepEqual(imageSize(file('b.jpg', jpeg)), { width: 400, height: 300 });

  assert.deepEqual(imageSize(file('c.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="240" viewBox="0 0 640 240"></svg>')), { width: 640, height: 240 });
  assert.deepEqual(imageSize(file('d.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 372"></svg>')), { width: 560, height: 372 });
  assert.equal(imageSize(join(dir, 'missing.jpg')), null);
});
