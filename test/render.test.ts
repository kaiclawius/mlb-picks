import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSite } from '../src/render.js';
import { sanitizeSpec } from '../src/spec.js';

const evil = '<script>alert(1)</script>"\'';

test('Inhalte werden escaped', () => {
  const spec = sanitizeSpec({
    name: evil, symbol: 'X<>', tagline: evil, about: evil,
    features: [{ title: evil, text: evil }], mode: 'dark', accent: 'red;}</style><script>',
  });
  const html = renderSite(spec, { images: [evil], mint: evil });
  assert.ok(!html.includes('<script>alert(1)'));
  assert.equal(spec.accent, '#f59f00', 'ungültige Akzentfarbe wird ersetzt');
  assert.equal(spec.symbol, 'MEME', 'ungültiges Symbol wird ersetzt');
});

test('Spec wird begrenzt', () => {
  const spec = sanitizeSpec({
    name: 'n'.repeat(100), symbol: 'abcdefghijklmnop', tagline: '', about: 'a'.repeat(1000),
    features: Array.from({ length: 9 }, () => ({ title: 't', text: 'x' })), mode: 'light', accent: '#112233',
  });
  assert.equal(spec.name.length, 32);
  assert.equal(spec.symbol, 'ABCDEFGHIJ');
  assert.equal(spec.about.length, 500);
  assert.equal(spec.features.length, 3);
});
