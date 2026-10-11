import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniffImage } from '../src/images.js';
import { PNG } from './helpers.js';

test('erkennt echte Bildformate an den Bytes', () => {
  assert.equal(sniffImage(PNG)?.ext, 'png');
  assert.equal(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))?.ext, 'jpg');
  assert.equal(sniffImage(Buffer.from('GIF89a....'))?.ext, 'gif');
  assert.equal(sniffImage(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))?.ext, 'webp');
});

test('lehnt SVG, HTML und Skripte ab, egal wie sie benannt sind', () => {
  assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImage(Buffer.from('<!doctype html><script>alert(1)</script>')), null);
  assert.equal(sniffImage(Buffer.from('')), null);
  assert.equal(sniffImage(Buffer.from('GIF')), null);
});
