import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { renderSite, WIDGET_HASH } from '../src/render.js';
import { sanitizeSpec } from '../src/spec.js';

const evil = '<script>alert(1)</script>"\'';

test('Inhalte werden escaped, ungültige Werte ersetzt', () => {
  const spec = sanitizeSpec({
    name: evil, symbol: 'X<>', tagline: evil, about: evil,
    features: [{ title: evil, text: evil }], mode: 'dark', accent: 'red;}</style><script>',
  });
  const html = renderSite(spec, { images: [evil], mint: evil });
  assert.ok(!html.includes('<script>alert(1)'));
  assert.equal(spec.accent, '#f59f00');
  assert.equal(spec.symbol, 'MEME');
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

test('CSP-Hash passt zum tatsächlichen Skript der Seite', () => {
  const spec = sanitizeSpec({ name: 'A', symbol: 'AB', tagline: '', about: '', features: [], mode: 'dark', accent: '#112233' });
  const html = renderSite(spec, { images: [] });
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  assert.equal(WIDGET_HASH, `'sha256-${createHash('sha256').update(script).digest('base64')}'`);
  assert.equal((html.match(/<script/g) ?? []).length, 1, 'genau ein Skript auf der Seite');
});

test('Seite mit Mint verlinkt pump.fun, ohne Mint nicht', () => {
  const spec = sanitizeSpec({ name: 'A', symbol: 'AB', tagline: '', about: '', features: [], mode: 'light', accent: '#112233' });
  const mint = 'So11111111111111111111111111111111111111112';
  assert.match(renderSite(spec, { images: [], mint }), /https:\/\/pump\.fun\/coin\/So111/);
  assert.doesNotMatch(renderSite(spec, { images: [] }), /pump\.fun\/coin/);
});
