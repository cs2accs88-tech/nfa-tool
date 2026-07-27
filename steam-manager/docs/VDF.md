# VDF (Steam KeyValues) parsing & serialization

Reliable, deterministic handling of Valve's KeyValues (VDF) text format used by
Steam config files (`loginusers.vdf`, `config.vdf`, `localconfig.vdf`, `local.vdf`).

- `src/utils/steamVdf.js` — pure parser, serializer, comparison and validation.
- `src/utils/vdfFile.js` — safe file I/O (atomic write, UTF-8/BOM, post-write validation, logging).
- `tests/unit/utils/steamVdf.test.js`, `tests/unit/utils/vdfFile.test.js` — 44 runnable tests.

Run the tests (no external dependencies — uses Node's built-in runner):

```
npm run test:vdf
```

---

## 1. Root cause analysis

The previous implementation represented parsed data as a **plain JavaScript
object** and used `fs.writeFileSync` directly. That caused several latent
reliability problems:

| # | Root cause | Consequence |
|---|-----------|-------------|
| 1 | Plain-object representation | V8 orders **integer-like keys ascending numerically**, not by insertion. SteamID64 keys (`"76561199..."`) in `loginusers.vdf` could be **silently reordered** on save. |
| 2 | Duplicate keys overwritten (last-wins) | Repeated keys at one level were **silently dropped** — data loss. |
| 3 | Lenient tokenizer | Unterminated quotes ran to EOF; stray `}`/`{` and keys without values were **silently tolerated**, so malformed input produced a wrong-but-quiet tree. |
| 4 | No encoding validation | Invalid UTF-8 was decoded to replacement characters (`U+FFFD`) and written back — **silent corruption**. |
| 5 | Non-atomic write | A crash mid-write could **truncate/corrupt** the real file. |
| 6 | No post-write validation | A serialize/parse defect would go **undetected**. |
| 7 | Comments discarded | `//` comments were dropped, breaking round-trip fidelity. |

## 2. Issues fixed

1. **Order/duplicate/comment preservation** — data is held in an ordered
   entries list (`KeyValues`), never a plain object. Input order (including
   numeric keys), duplicate keys and comments are preserved exactly.
2. **Strict parsing** — malformed input throws `VdfParseError` with the precise
   `line`, `column`, `offset`, originating `fn`, and a `suggestion`. Nothing is
   silently ignored; non-fatal oddities (unknown escapes, NUL-in-string) are
   returned as structured `warnings`.
3. **Deterministic, safe serialization** — canonical tab indentation, quoted
   keys/values, `\n` endings, symmetric escaping, and a hard guarantee of **no
   NUL bytes** in output. `stringify` is a pure function of the tree.
4. **Encoding** — files are read as binary, UTF-8 is validated with a precise
   bad-byte offset (rejecting overlong/surrogate/out-of-range sequences), and a
   BOM is detected and preserved.
5. **Atomic writes** — write to a temp file → `fsync` → `rename` over the target
   (with short retries for transient Windows locks). No partial files.
6. **Post-write validation** — after writing, the file is re-read, re-parsed and
   `deepEqual`-compared to the in-memory tree. Any divergence throws with the
   exact path, expected and actual values.
7. **Verbose logging** — inject a logger (`createConsoleLogger()`); logs path,
   size before/after, serialize/parse/validate durations, warnings and errors.

## 3. API quick reference

```js
const { parse, stringify, deepEqual, validate, KeyValues } = require('./src/utils/steamVdf');
const { readVdfFile, writeVdfFile } = require('./src/utils/vdfFile');

const { root, warnings } = parse(text);          // strict; throws VdfParseError
root.get('users').get('765...').set('MostRecent', '1');
const text2 = stringify(root);                    // deterministic
const cmp = deepEqual(a, b);                       // { equal, path, reason, expected, actual }
const report = validate(text);                     // { valid, errors, warnings, duplicates }

const { root, stats } = readVdfFile(path, { logger });         // UTF-8/BOM checked
writeVdfFile(path, root, { logger, validateAfterWrite: true }); // atomic + validated
```

## 4. Integrity checks

`validate(text)` reports, without throwing: parse errors (missing braces,
invalid quotes, key-without-value) with location; duplicate keys per level; and
parser warnings (unknown escapes, NUL bytes). `firstInvalidUtf8Offset(buffer)`
reports the first invalid UTF-8 byte.

## 5. Performance impact

Measured on the dev machine via `npm run test:vdf` (Node 20, portable):

- **5,000-account file** (`loginusers.vdf`-shaped): serialize + atomic write +
  full post-write reload/deep-compare completes in ~0.5 s.
- Parser and serializer are single-pass, O(n) in input size.
- The extra cost vs. the naive approach is: one additional full read+parse on
  save (post-write validation) and an `fsync`. This roughly **doubles save time**
  for the safety guarantee, but absolute times remain sub-second for real Steam
  files (which have a handful of accounts, not thousands). Post-write validation
  can be disabled per-call with `writeVdfFile(path, kv, { validateAfterWrite: false })`
  if ever needed for very hot paths.

## 6. Tests (44, all passing)

Load original, save-unmodified byte-stability, modify a single value + reload +
deep compare, add-key detection, large files (5k), empty files, malformed files
(with location), unicode, escaped strings, duplicate keys, CRLF/LF equivalence,
integrity checks, invalid-UTF-8 detection, BOM handling, atomic-write (no temp
leftovers), and post-write validation.
