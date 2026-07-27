/**
 * Unit + regression tests for src/utils/vdfFile.js (file I/O, atomic write,
 * post-write validation, UTF-8/BOM handling).
 *
 *   node --test tests/unit/utils/vdfFile.test.js
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const steamVdf = require(path.join(__dirname, '..', '..', '..', 'src', 'utils', 'steamVdf'));
const vdfFile = require(path.join(__dirname, '..', '..', '..', 'src', 'utils', 'vdfFile'));
const { KeyValues, parse, stringify, deepEqual } = steamVdf;
const { readVdfFile, writeVdfFile, firstInvalidUtf8Offset } = vdfFile;

let TMP;

before(() => { TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vdf-test-')); });
after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ } });

function tmpFile(name) { return path.join(TMP, name); }

const SAMPLE = [
  '"users"',
  '{',
  '\t"76561199486156161"',
  '\t{',
  '\t\t"AccountName"\t\t"alpha"',
  '\t\t"MostRecent"\t\t"1"',
  '\t}',
  '\t"76561198000000000"',
  '\t{',
  '\t\t"AccountName"\t\t"bravo"',
  '\t}',
  '}',
  ''
].join('\n');

describe('read / write round-trip', () => {
  it('writes then reads back an identical tree', () => {
    const f = tmpFile('loginusers.vdf');
    const kv = parse(SAMPLE).root;
    const res = writeVdfFile(f, kv);
    assert.ok(res.bytesWritten > 0);
    assert.equal(res.validated, true);

    const { root } = readVdfFile(f);
    assert.ok(deepEqual(kv, root).equal);
  });

  it('save-without-modification is value-stable', () => {
    const f = tmpFile('stable.vdf');
    const kv = parse(SAMPLE).root;
    writeVdfFile(f, kv);
    const first = fs.readFileSync(f, 'utf8');
    const reread = readVdfFile(f).root;
    writeVdfFile(f, reread);
    const second = fs.readFileSync(f, 'utf8');
    assert.equal(first, second, 're-saving unchanged data must be byte-identical');
  });

  it('modifying a single existing value changes only that value', () => {
    const f = tmpFile('modify.vdf');
    const kv = parse(SAMPLE).root;
    writeVdfFile(f, kv);

    // The first account already has MostRecent "1"; flip it in place.
    const loaded = readVdfFile(f).root;
    loaded.get('users').get('76561199486156161').set('MostRecent', '0');
    writeVdfFile(f, loaded);

    const after = readVdfFile(f).root;
    assert.equal(after.get('users').get('76561199486156161').get('MostRecent'), '0');
    // Sibling account untouched
    assert.equal(after.get('users').get('76561198000000000').get('AccountName'), 'bravo');
    // The only difference from the original is that one value, located precisely.
    const cmp = deepEqual(kv, after);
    assert.equal(cmp.equal, false);
    assert.ok(cmp.path.includes('MostRecent'), `diff path was ${cmp.path}`);
    assert.equal(cmp.expected, '1');
    assert.equal(cmp.actual, '0');
  });

  it('adding a new key is detected as an entry-count change', () => {
    const f = tmpFile('add.vdf');
    const kv = parse(SAMPLE).root;
    writeVdfFile(f, kv);

    const loaded = readVdfFile(f).root;
    loaded.get('users').get('76561198000000000').set('MostRecent', '1'); // did not exist -> appended
    writeVdfFile(f, loaded);

    const after = readVdfFile(f).root;
    assert.equal(after.get('users').get('76561198000000000').get('MostRecent'), '1');
    const cmp = deepEqual(kv, after);
    assert.equal(cmp.equal, false);
    assert.ok(/Entry count differs/.test(cmp.reason), `reason was ${cmp.reason}`);
  });
});

describe('atomic write + post-write validation', () => {
  it('leaves no temp files behind', () => {
    const f = tmpFile('atomic.vdf');
    writeVdfFile(f, parse(SAMPLE).root);
    const leftovers = fs.readdirSync(TMP).filter((n) => n.includes('.tmp'));
    assert.deepEqual(leftovers, []);
  });

  it('reports validation timing and success', () => {
    const f = tmpFile('validated.vdf');
    const res = writeVdfFile(f, parse(SAMPLE).root, { validateAfterWrite: true });
    assert.equal(res.validated, true);
    assert.ok(res.serializeMs >= 0);
    assert.ok(res.validateMs >= 0);
  });
});

describe('encoding: UTF-8, BOM, unicode, escapes', () => {
  it('round-trips unicode persona names', () => {
    const f = tmpFile('unicode.vdf');
    const kv = new KeyValues().append('users', new KeyValues()
      .append('76561199000000001', new KeyValues().append('PersonaName', 'Пример 名前 🎮')));
    writeVdfFile(f, kv);
    const back = readVdfFile(f).root;
    assert.equal(back.get('users').get('76561199000000001').get('PersonaName'), 'Пример 名前 🎮');
  });

  it('round-trips escaped strings (newline/tab/quote/backslash)', () => {
    const f = tmpFile('escapes.vdf');
    const kv = new KeyValues().append('k', 'a\tb\nc"d\\e');
    writeVdfFile(f, kv);
    assert.equal(readVdfFile(f).root.get('k'), 'a\tb\nc"d\\e');
  });

  it('detects and preserves a UTF-8 BOM', () => {
    const f = tmpFile('bom.vdf');
    const kv = parse('"a" "1"').root;
    writeVdfFile(f, kv, { bom: true });
    const raw = fs.readFileSync(f);
    assert.equal(raw[0], 0xef);
    const res = readVdfFile(f);
    assert.equal(res.stats.hadBom, true);
    assert.equal(res.root.get('a'), '1');
  });

  it('rejects invalid UTF-8 with a byte offset', () => {
    const f = tmpFile('bad-utf8.vdf');
    fs.writeFileSync(f, Buffer.from([0x22, 0x61, 0x22, 0x20, 0x22, 0xff, 0x22])); // "a" "<0xFF>"
    assert.throws(() => readVdfFile(f), (e) => /not valid UTF-8/.test(e.message) && typeof e.offset === 'number');
  });

  it('firstInvalidUtf8Offset accepts valid and flags invalid', () => {
    assert.equal(firstInvalidUtf8Offset(Buffer.from('héllo 🎮', 'utf8')), -1);
    assert.equal(firstInvalidUtf8Offset(Buffer.from([0x41, 0xc0, 0x80])), 1); // overlong
  });
});

describe('edge cases', () => {
  it('reads an empty file as an empty tree', () => {
    const f = tmpFile('empty.vdf');
    fs.writeFileSync(f, '');
    assert.equal(readVdfFile(f).root.entries.length, 0);
  });

  it('surfaces malformed files with file path + location', () => {
    const f = tmpFile('malformed.vdf');
    fs.writeFileSync(f, '"a" { "b" "1"'); // missing closing brace
    try {
      readVdfFile(f);
      assert.fail('expected throw');
    } catch (e) {
      assert.equal(e.file, f);
      assert.ok(e.line >= 1);
      assert.ok(e.suggestion);
    }
  });

  it('throws a clear error when the file does not exist', () => {
    assert.throws(() => readVdfFile(tmpFile('nope.vdf')), (e) => /does not exist/.test(e.suggestion || ''));
  });
});

describe('performance: large file', () => {
  it('handles 5,000 accounts within a reasonable time', () => {
    const f = tmpFile('large.vdf');
    const users = new KeyValues();
    for (let i = 0; i < 5000; i += 1) {
      const id = String(76561199000000000 + i);
      users.append(id, new KeyValues()
        .append('AccountName', 'user_' + i)
        .append('PersonaName', 'Persona ' + i)
        .append('MostRecent', i === 0 ? '1' : '0')
        .append('Timestamp', String(1700000000 + i)));
    }
    const kv = new KeyValues().append('users', users);

    const t0 = process.hrtime.bigint();
    const res = writeVdfFile(f, kv, { validateAfterWrite: true });
    const totalMs = Number(process.hrtime.bigint() - t0) / 1e6;

    const back = readVdfFile(f).root;
    assert.ok(deepEqual(kv, back).equal, 'large file must round-trip exactly');
    assert.equal(back.get('users').keys().length, 5000);
    assert.ok(totalMs < 5000, `write+validate should be well under 5s (was ${totalMs.toFixed(0)}ms)`);
  });
});
