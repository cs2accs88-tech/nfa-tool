/**
 * Unit tests for src/utils/steamVdf.js
 *
 * Runs on Node's built-in test runner (no external deps):
 *   node --test tests/unit/utils/steamVdf.test.js
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const vdf = require(path.join(__dirname, '..', '..', '..', 'src', 'utils', 'steamVdf'));
const { KeyValues, parse, stringify, deepEqual, validate, VdfParseError, VdfSerializeError, findKeyCI, ensurePath } = vdf;

const SAMPLE = [
  '"users"',
  '{',
  '\t"76561199486156161"',
  '\t{',
  '\t\t"AccountName"\t\t"alpha"',
  '\t\t"RememberPassword"\t\t"1"',
  '\t\t"MostRecent"\t\t"1"',
  '\t}',
  '\t"76561198000000000"',
  '\t{',
  '\t\t"AccountName"\t\t"bravo"',
  '\t\t"MostRecent"\t\t"0"',
  '\t}',
  '}',
  ''
].join('\n');

describe('tokenizer + parser', () => {
  it('parses nested objects and quoted strings', () => {
    const { root } = parse(SAMPLE);
    const users = root.get('users');
    assert.ok(users instanceof KeyValues, 'users should be an object');
    const a = users.get('76561199486156161');
    assert.equal(a.get('AccountName'), 'alpha');
    assert.equal(a.get('RememberPassword'), '1');
  });

  it('preserves the order of integer-like keys (SteamID64) — no numeric reordering', () => {
    const { root } = parse(SAMPLE);
    const keys = root.get('users').keys();
    assert.deepEqual(keys, ['76561199486156161', '76561198000000000'],
      'input order must be preserved, not ascending numeric order');
  });

  it('handles empty values', () => {
    const { root } = parse('"k" ""');
    assert.equal(root.get('k'), '');
  });

  it('decodes escaped characters', () => {
    const { root } = parse('"path" "line1\\nline2\\ttab\\\\slash\\"quote"');
    assert.equal(root.get('path'), 'line1\nline2\ttab\\slash"quote');
  });

  it('keeps unknown escapes literally and warns', () => {
    const { root, warnings } = parse('"k" "a\\zb"');
    assert.equal(root.get('k'), 'a\\zb');
    assert.ok(warnings.some((w) => w.code === 'UNKNOWN_ESCAPE'));
  });

  it('treats CRLF and LF identically', () => {
    const lf = parse('"a" { "b" "1" }').root;
    const crlf = parse('"a"\r\n{\r\n"b" "1"\r\n}\r\n').root;
    assert.ok(deepEqual(lf, crlf).equal);
  });

  it('preserves duplicate keys (never silently overwrites)', () => {
    const { root } = parse('"dup" "1" "dup" "2"');
    assert.deepEqual(root.getAll('dup'), ['1', '2']);
  });

  it('parses unquoted (bare) tokens', () => {
    const { root } = parse('key value');
    assert.equal(root.get('key'), 'value');
  });

  it('preserves comments', () => {
    const src = '// header\n"a" "1"\n';
    const { root } = parse(src);
    assert.ok(root.entries.some((e) => e.kind === 'comment' && e.text.includes('header')));
    assert.ok(stringify(root).includes('// header'));
  });

  it('parses an empty document to an empty tree', () => {
    const { root } = parse('   \n\t \n');
    assert.equal(root.entries.length, 0);
  });
});

describe('parser errors (never silently ignore malformed data)', () => {
  it('throws on an unterminated quoted string with a location', () => {
    try {
      parse('"key" "unterminated');
      assert.fail('expected a throw');
    } catch (e) {
      assert.ok(e instanceof VdfParseError);
      assert.equal(typeof e.line, 'number');
      assert.equal(typeof e.column, 'number');
      assert.ok(e.suggestion);
    }
  });

  it('throws on a missing closing brace', () => {
    assert.throws(() => parse('"a" { "b" "1"'), (e) => e instanceof VdfParseError && /missing "}"/i.test(e.message));
  });

  it('throws on an extra closing brace', () => {
    assert.throws(() => parse('"a" "1" }'), (e) => e instanceof VdfParseError && /no matching "\{"/i.test(e.message));
  });

  it('throws on a key with no value at end of file', () => {
    assert.throws(() => parse('"a" "1" "dangling"'), (e) => e instanceof VdfParseError && /no value/i.test(e.message));
  });

  it('throws on a key with no value before a closing brace', () => {
    assert.throws(() => parse('"outer" { "key" }'), (e) => e instanceof VdfParseError && /no value/i.test(e.message));
  });
});

describe('serializer', () => {
  it('produces deterministic output', () => {
    const { root } = parse(SAMPLE);
    assert.equal(stringify(root), stringify(root));
  });

  it('round-trips (parse -> stringify -> parse is value-stable)', () => {
    const { root } = parse(SAMPLE);
    const again = parse(stringify(root)).root;
    const cmp = deepEqual(root, again);
    assert.ok(cmp.equal, cmp.reason || 'round-trip mismatch');
  });

  it('serialized SteamID order matches input order', () => {
    const out = stringify(parse(SAMPLE).root);
    assert.ok(out.indexOf('76561199486156161') < out.indexOf('76561198000000000'),
      'the higher SteamID appears first because it was first in the input');
  });

  it('escapes special characters symmetrically', () => {
    const kv = new KeyValues().append('k', 'tab\tnl\nq"bs\\');
    const back = parse(stringify(kv)).root;
    assert.equal(back.get('k'), 'tab\tnl\nq"bs\\');
  });

  it('refuses to serialize a NUL byte', () => {
    const kv = new KeyValues().append('k', 'a\u0000b');
    assert.throws(() => stringify(kv), (e) => e instanceof VdfSerializeError);
  });

  it('rejects non-KeyValues input', () => {
    assert.throws(() => stringify({ not: 'kv' }), (e) => e instanceof VdfSerializeError);
  });
});

describe('deepEqual', () => {
  it('reports equal trees', () => {
    assert.ok(deepEqual(parse(SAMPLE).root, parse(SAMPLE).root).equal);
  });

  it('locates a differing value', () => {
    const a = parse('"o" { "k" "1" }').root;
    const b = parse('"o" { "k" "2" }').root;
    const cmp = deepEqual(a, b);
    assert.equal(cmp.equal, false);
    assert.equal(cmp.expected, '1');
    assert.equal(cmp.actual, '2');
    assert.ok(cmp.path.includes('"k"'));
  });

  it('detects a differing entry count', () => {
    const a = parse('"a" "1" "b" "2"').root;
    const b = parse('"a" "1"').root;
    assert.equal(deepEqual(a, b).equal, false);
  });
});

describe('validate (integrity checks)', () => {
  it('accepts well-formed VDF', () => {
    const r = validate(SAMPLE);
    assert.equal(r.valid, true);
    assert.equal(r.errors.length, 0);
  });

  it('reports duplicate keys', () => {
    const r = validate('"root" { "x" "1" "x" "2" }');
    assert.equal(r.valid, true, 'duplicates are valid syntax but flagged');
    assert.ok(r.duplicates.some((d) => d.key === 'x'));
  });

  it('reports malformed structure with location', () => {
    const r = validate('"a" { "b" "1"');
    assert.equal(r.valid, false);
    assert.ok(r.errors[0].line >= 1);
    assert.ok(r.errors[0].suggestion);
  });
});

describe('navigation helpers', () => {
  it('findKeyCI matches case-insensitively', () => {
    const { root } = parse('"Software" { "Valve" "x" }');
    assert.equal(findKeyCI(root, 'software'), 'Software');
  });

  it('ensurePath creates nested nodes without clobbering siblings', () => {
    const root = parse('"InstallConfigStore" { "keep" "yes" }').root;
    const node = ensurePath(root, ['InstallConfigStore', 'Software', 'Valve', 'Steam', 'Accounts']);
    node.set('bob', new KeyValues().append('SteamID', '123'));
    const store = root.get('InstallConfigStore');
    assert.equal(store.get('keep'), 'yes', 'existing sibling preserved');
    assert.equal(store.get('Software').get('Valve').get('Steam').get('Accounts').get('bob').get('SteamID'), '123');
  });
});
