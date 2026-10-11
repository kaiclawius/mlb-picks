import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, isMintAddress } from '../src/transparency.js';

const base = { mintAuthority: null, freezeAuthority: null, supply: 1000, decimals: 6, largest: [] };

test('abgegebene Authorities sind pass', () => {
  const checks = analyze(base);
  assert.deepEqual(checks.map((c) => c.status), ['pass', 'pass']);
});

test('aktive Authorities sind fail', () => {
  const checks = analyze({ ...base, mintAuthority: 'Abc', freezeAuthority: 'Def' });
  assert.equal(checks[0].status, 'fail');
  assert.equal(checks[1].status, 'fail');
});

test('Konzentration: Top-10 über 90 % warnt, sonst info', () => {
  const holders = (amounts: number[]) => amounts.map((amount, i) => ({ address: `a${i}`, amount }));
  assert.equal(analyze({ ...base, largest: holders([950]) }).at(-1)!.status, 'warn');
  assert.equal(analyze({ ...base, largest: holders([100, 100, 100]) }).at(-1)!.status, 'info');
});

test('Adressprüfung', () => {
  assert.ok(isMintAddress('So11111111111111111111111111111111111111112'));
  assert.ok(!isMintAddress('../etc/passwd'));
  assert.ok(!isMintAddress('0OIl'));
});
