/**
 * @module utils/steamVdf
 * @description Reliable, deterministic parser and serializer for Valve's
 * KeyValues (VDF) text format — the format used by Steam config files such as
 * `loginusers.vdf`, `config.vdf` and `localconfig.vdf`.
 *
 * Design goals (why this is not a naive parser):
 *  - **Order + duplicate + comment preserving.** Parsed data is kept in an
 *    ordered entries list (see {@link KeyValues}), NOT a plain JS object. A
 *    plain object reorders integer-like keys (SteamID64s such as
 *    "76561199...") to ascending numeric order, which would silently reshuffle
 *    accounts in loginusers.vdf. The entries list preserves the exact input
 *    order and any duplicate keys.
 *  - **Strict.** Malformed input is never silently ignored: unterminated
 *    quotes, unbalanced braces, keys without values and stray tokens all raise
 *    a {@link VdfParseError} carrying the precise line/column/offset, the
 *    function that raised it, and a suggested fix. Non-fatal oddities (unknown
 *    escapes, control characters) are surfaced as structured warnings.
 *  - **Deterministic + safe serialization.** Output uses canonical Steam
 *    formatting (tab indentation, quoted keys/values, `\n` line endings),
 *    escapes exactly the inverse of what the parser unescapes, never emits a
 *    NUL byte, and is a pure function of the input tree.
 *  - **Round-trippable.** `parse` → `stringify` → `parse` is value-stable, and
 *    {@link deepEqual} can prove it.
 *
 * This module is dependency-free pure JavaScript so it can be unit-tested with
 * the Node test runner without Electron or native modules.
 */

'use strict';

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * Base error for all VDF failures. Always carries enough context to locate and
 * fix the problem (never a bare message).
 */
class VdfError extends Error {
  /**
   * @param {string} message
   * @param {object} [info]
   * @param {string} [info.fn] - originating function name
   * @param {string} [info.file] - file path (when known)
   * @param {number} [info.line] - 1-based line
   * @param {number} [info.column] - 1-based column
   * @param {number} [info.offset] - 0-based byte/char offset
   * @param {string} [info.suggestion] - how to fix it
   */
  constructor(message, info = {}) {
    const loc = info.line != null ? ` (line ${info.line}, column ${info.column})` : '';
    super(`${message}${loc}`);
    this.name = this.constructor.name;
    this.fn = info.fn || null;
    this.file = info.file || null;
    this.line = info.line != null ? info.line : null;
    this.column = info.column != null ? info.column : null;
    this.offset = info.offset != null ? info.offset : null;
    this.suggestion = info.suggestion || null;
  }

  /** @returns {object} a plain, log-friendly representation. */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      fn: this.fn,
      file: this.file,
      line: this.line,
      column: this.column,
      offset: this.offset,
      suggestion: this.suggestion
    };
  }
}

/** Raised while tokenizing/parsing malformed VDF text. */
class VdfParseError extends VdfError {}

/** Raised while serializing an invalid in-memory tree. */
class VdfSerializeError extends VdfError {}

/* ------------------------------------------------------------------ */
/* KeyValues container (ordered, duplicate + comment preserving)       */
/* ------------------------------------------------------------------ */

/**
 * An ordered KeyValues node. Internally an array of entries, each of which is
 * either a key/value pair or a preserved comment:
 *   - `{ kind: 'pair', key: string, value: string | KeyValues }`
 *   - `{ kind: 'comment', text: string }`
 *
 * Order, duplicate keys and comments are all preserved exactly.
 */
class KeyValues {
  constructor() {
    /** @type {Array<{kind:string, key?:string, value?:(string|KeyValues), text?:string}>} */
    this.entries = [];
  }

  /** @param {*} x @returns {boolean} */
  static isKeyValues(x) {
    return x instanceof KeyValues;
  }

  /** Appends a key/value pair (preserves duplicates). @returns {KeyValues} this */
  append(key, value) {
    this.entries.push({ kind: 'pair', key: String(key), value });
    return this;
  }

  /** Appends a comment entry. @returns {KeyValues} this */
  appendComment(text) {
    this.entries.push({ kind: 'comment', text: String(text) });
    return this;
  }

  /**
   * Sets the value of the first pair with `key`, or appends a new pair.
   * @returns {KeyValues} this
   */
  set(key, value) {
    const k = String(key);
    const entry = this.entries.find((e) => e.kind === 'pair' && e.key === k);
    if (entry) entry.value = value;
    else this.append(k, value);
    return this;
  }

  /** @returns {(string|KeyValues|undefined)} value of the first pair with `key`. */
  get(key) {
    const k = String(key);
    const entry = this.entries.find((e) => e.kind === 'pair' && e.key === k);
    return entry ? entry.value : undefined;
  }

  /** @returns {Array<string|KeyValues>} values of every pair with `key`. */
  getAll(key) {
    const k = String(key);
    return this.entries.filter((e) => e.kind === 'pair' && e.key === k).map((e) => e.value);
  }

  /** @returns {boolean} whether any pair has `key`. */
  has(key) {
    const k = String(key);
    return this.entries.some((e) => e.kind === 'pair' && e.key === k);
  }

  /** Removes every pair with `key`. @returns {number} count removed. */
  delete(key) {
    const k = String(key);
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => !(e.kind === 'pair' && e.key === k));
    return before - this.entries.length;
  }

  /** @returns {Array<{key:string, value:(string|KeyValues)}>} pair entries only. */
  pairs() {
    return this.entries.filter((e) => e.kind === 'pair').map((e) => ({ key: e.key, value: e.value }));
  }

  /** @returns {string[]} keys in order (duplicates included). */
  keys() {
    return this.entries.filter((e) => e.kind === 'pair').map((e) => e.key);
  }

  /**
   * Collapses to a plain object (last value wins on duplicate keys). Lossy for
   * duplicates/comments/order of integer-like keys — use only for convenience.
   * @returns {object}
   */
  toObject() {
    const out = {};
    for (const e of this.entries) {
      if (e.kind !== 'pair') continue;
      out[e.key] = e.value instanceof KeyValues ? e.value.toObject() : e.value;
    }
    return out;
  }

  /**
   * Builds a KeyValues from a plain object. Note: JS object key order applies
   * (integer-like keys reorder), so prefer building via append() when order of
   * numeric keys matters.
   * @param {object} obj
   * @returns {KeyValues}
   */
  static fromObject(obj) {
    const kv = new KeyValues();
    for (const [k, v] of Object.entries(obj || {})) {
      if (v !== null && typeof v === 'object' && !(v instanceof KeyValues)) {
        kv.append(k, KeyValues.fromObject(v));
      } else {
        kv.append(k, v);
      }
    }
    return kv;
  }
}

/* ------------------------------------------------------------------ */
/* Tokenizer                                                           */
/* ------------------------------------------------------------------ */

const TT = Object.freeze({ STRING: 'string', LBRACE: 'lbrace', RBRACE: 'rbrace', COMMENT: 'comment' });

const KNOWN_ESCAPES = Object.freeze({ n: '\n', t: '\t', '\\': '\\', '"': '"', r: '\r' });

/**
 * Converts VDF text into a flat token stream with precise positions.
 * @param {string} text
 * @param {object} [opts]
 * @param {(w: object) => void} [opts.onWarn] - receives structured warnings
 * @returns {Array<object>} tokens: { type, value?, line, column, offset }
 */
function tokenize(text, opts = {}) {
  const onWarn = typeof opts.onWarn === 'function' ? opts.onWarn : () => {};
  const tokens = [];
  const len = text.length;
  let i = 0;
  let line = 1;
  let col = 1;

  /** Advances one character, tracking line/column. */
  function advance() {
    const ch = text[i];
    i += 1;
    if (ch === '\n') { line += 1; col = 1; } else { col += 1; }
    return ch;
  }

  while (i < len) {
    const ch = text[i];

    // Whitespace (space, tab, CR, LF) — handles both CRLF and LF.
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') { advance(); continue; }

    const startLine = line;
    const startCol = col;
    const startOffset = i;

    // Comment: // ... to end of line
    if (ch === '/' && text[i + 1] === '/') {
      advance(); advance(); // consume //
      let commentText = '';
      while (i < len && text[i] !== '\n') commentText += advance();
      tokens.push({ type: TT.COMMENT, value: commentText, line: startLine, column: startCol, offset: startOffset });
      continue;
    }

    if (ch === '{') { advance(); tokens.push({ type: TT.LBRACE, line: startLine, column: startCol, offset: startOffset }); continue; }
    if (ch === '}') { advance(); tokens.push({ type: TT.RBRACE, line: startLine, column: startCol, offset: startOffset }); continue; }

    // Quoted string
    if (ch === '"') {
      advance(); // opening quote
      let value = '';
      let closed = false;
      while (i < len) {
        const c = text[i];
        if (c === '\\') {
          advance(); // backslash
          if (i >= len) break; // trailing backslash -> unterminated handled below
          const esc = text[i];
          if (Object.prototype.hasOwnProperty.call(KNOWN_ESCAPES, esc)) {
            value += KNOWN_ESCAPES[esc];
            advance();
          } else {
            // Unknown escape: keep literally (backslash + char), never silently drop.
            onWarn({
              code: 'UNKNOWN_ESCAPE',
              message: `Unknown escape sequence "\\${esc}" kept literally`,
              line, column: col, offset: i
            });
            value += '\\' + esc;
            advance();
          }
          continue;
        }
        if (c === '"') { advance(); closed = true; break; }
        if (c === '\0') {
          onWarn({ code: 'NUL_IN_STRING', message: 'NUL byte inside quoted string', line, column: col, offset: i });
        }
        value += advance();
      }
      if (!closed) {
        throw new VdfParseError('Unterminated quoted string', {
          fn: 'tokenize', line: startLine, column: startCol, offset: startOffset,
          suggestion: 'Add the missing closing double-quote (") for this string.'
        });
      }
      tokens.push({ type: TT.STRING, value, line: startLine, column: startCol, offset: startOffset });
      continue;
    }

    // Unquoted token (Steam permits bare tokens): read until whitespace/brace/quote.
    let raw = '';
    while (i < len) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '{' || c === '}' || c === '"') break;
      if (c === '/' && text[i + 1] === '/') break;
      raw += advance();
    }
    tokens.push({ type: TT.STRING, value: raw, line: startLine, column: startCol, offset: startOffset });
  }

  return tokens;
}

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

/**
 * Parses VDF text into a {@link KeyValues} tree. Strict: throws
 * {@link VdfParseError} on any malformed structure. Never silently drops data.
 *
 * @param {string} text - VDF source (already decoded to a JS string)
 * @param {object} [opts]
 * @param {number} [opts.maxDepth=100] - guard against pathological nesting
 * @param {(w: object) => void} [opts.onWarn] - warning sink
 * @returns {{ root: KeyValues, warnings: object[] }}
 */
function parse(text, opts = {}) {
  if (typeof text !== 'string') {
    throw new VdfParseError('parse() expects a string', {
      fn: 'parse', suggestion: 'Decode the file to a UTF-8 string before parsing (see vdfFile.readVdfFile).'
    });
  }
  const maxDepth = opts.maxDepth || 100;
  const warnings = [];
  const onWarn = (w) => { warnings.push(w); if (typeof opts.onWarn === 'function') opts.onWarn(w); };

  const tokens = tokenize(text, { onWarn });
  let pos = 0;

  /**
   * Parses a sequence of entries until EOF (top level) or a matching '}'.
   * @param {number} depth
   * @param {object|null} openBrace - the '{' token that opened this block, or null at top level
   * @returns {KeyValues}
   */
  function parseBlock(depth, openBrace) {
    if (depth > maxDepth) {
      throw new VdfParseError(`Maximum nesting depth (${maxDepth}) exceeded`, {
        fn: 'parseBlock', line: openBrace ? openBrace.line : 1, column: openBrace ? openBrace.column : 1,
        suggestion: 'The file is nested too deeply or a brace is unbalanced.'
      });
    }
    const kv = new KeyValues();

    while (pos < tokens.length) {
      const tok = tokens[pos];

      if (tok.type === TT.RBRACE) {
        if (!openBrace) {
          throw new VdfParseError('Unexpected "}" with no matching "{"', {
            fn: 'parseBlock', line: tok.line, column: tok.column, offset: tok.offset,
            suggestion: 'Remove the extra closing brace or add the missing opening brace.'
          });
        }
        pos += 1; // consume '}'
        return kv;
      }

      if (tok.type === TT.COMMENT) {
        kv.appendComment(tok.value);
        pos += 1;
        continue;
      }

      if (tok.type === TT.LBRACE) {
        throw new VdfParseError('Unexpected "{" — a key must precede a block', {
          fn: 'parseBlock', line: tok.line, column: tok.column, offset: tok.offset,
          suggestion: 'Add a quoted key name before this "{".'
        });
      }

      // tok is a key (string)
      const keyTok = tok;
      pos += 1;

      // Skip comments between key and value, preserving them.
      const interstitialComments = [];
      while (pos < tokens.length && tokens[pos].type === TT.COMMENT) {
        interstitialComments.push(tokens[pos].value);
        pos += 1;
      }

      const next = tokens[pos];
      if (!next) {
        throw new VdfParseError(`Key "${keyTok.value}" has no value (unexpected end of file)`, {
          fn: 'parseBlock', line: keyTok.line, column: keyTok.column, offset: keyTok.offset,
          suggestion: 'Add a value or a { ... } block after this key.'
        });
      }

      if (next.type === TT.LBRACE) {
        const brace = next;
        pos += 1; // consume '{'
        const child = parseBlock(depth + 1, brace);
        kv.append(keyTok.value, child);
      } else if (next.type === TT.STRING) {
        kv.append(keyTok.value, next.value);
        pos += 1;
      } else if (next.type === TT.RBRACE) {
        throw new VdfParseError(`Key "${keyTok.value}" has no value before "}"`, {
          fn: 'parseBlock', line: keyTok.line, column: keyTok.column, offset: keyTok.offset,
          suggestion: 'Give this key a value (e.g. "") or a { ... } block.'
        });
      }

      // Re-attach interstitial comments after the pair so they are not lost.
      for (const c of interstitialComments) kv.appendComment(c);
    }

    // Reached EOF
    if (openBrace) {
      throw new VdfParseError('Unterminated block — missing "}"', {
        fn: 'parseBlock', line: openBrace.line, column: openBrace.column, offset: openBrace.offset,
        suggestion: 'Add the "}" that closes the block opened here.'
      });
    }
    return kv;
  }

  const root = parseBlock(0, null);
  return { root, warnings };
}

/* ------------------------------------------------------------------ */
/* Serializer                                                          */
/* ------------------------------------------------------------------ */

/**
 * Escapes a string for VDF output (inverse of the tokenizer's unescape).
 * @param {string} str
 * @param {string} fnName - for error context
 * @returns {string}
 */
function escapeString(str, fnName) {
  const s = String(str);
  if (s.indexOf('\0') !== -1) {
    throw new VdfSerializeError('Refusing to serialize a value containing a NUL byte', {
      fn: fnName, suggestion: 'Remove NUL (\\u0000) characters from the value before serializing.'
    });
  }
  let out = '';
  for (let k = 0; k < s.length; k += 1) {
    const c = s[k];
    if (c === '\\') out += '\\\\';
    else if (c === '"') out += '\\"';
    else if (c === '\n') out += '\\n';
    else if (c === '\t') out += '\\t';
    else if (c === '\r') out += '\\r';
    else out += c;
  }
  return out;
}

/**
 * Serializes a {@link KeyValues} tree to canonical VDF text. Deterministic:
 * tab indentation, quoted keys/values, `\n` line endings, comments preserved.
 *
 * @param {KeyValues} kv
 * @param {object} [opts]
 * @param {string} [opts.indent='\t']
 * @param {string} [opts.eol='\n']
 * @returns {string}
 */
function stringify(kv, opts = {}) {
  if (!(kv instanceof KeyValues)) {
    throw new VdfSerializeError('stringify() expects a KeyValues instance', {
      fn: 'stringify', suggestion: 'Pass the tree returned by parse().root, or build one with new KeyValues().'
    });
  }
  const indentUnit = opts.indent != null ? opts.indent : '\t';
  const eol = opts.eol != null ? opts.eol : '\n';

  const parts = [];

  /**
   * @param {KeyValues} node
   * @param {number} depth
   */
  function writeNode(node, depth) {
    const pad = indentUnit.repeat(depth);
    for (const e of node.entries) {
      if (e.kind === 'comment') {
        parts.push(`${pad}//${e.text}${eol}`);
        continue;
      }
      const key = escapeString(e.key, 'stringify');
      if (e.value instanceof KeyValues) {
        parts.push(`${pad}"${key}"${eol}`);
        parts.push(`${pad}{${eol}`);
        writeNode(e.value, depth + 1);
        parts.push(`${pad}}${eol}`);
      } else {
        parts.push(`${pad}"${key}"\t\t"${escapeString(e.value, 'stringify')}"${eol}`);
      }
    }
  }

  writeNode(kv, 0);
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* Deep structural comparison (for post-write validation)              */
/* ------------------------------------------------------------------ */

/**
 * Compares two KeyValues trees for exact structural equality (order-sensitive).
 * @param {KeyValues} a - expected
 * @param {KeyValues} b - actual
 * @param {object} [opts]
 * @param {boolean} [opts.ignoreComments=false]
 * @param {string} [opts.path='']
 * @returns {{ equal: boolean, path?: string, reason?: string, expected?: *, actual?: * }}
 */
function deepEqual(a, b, opts = {}) {
  const ignoreComments = !!opts.ignoreComments;
  const path = opts.path || '(root)';

  if (!(a instanceof KeyValues) || !(b instanceof KeyValues)) {
    return { equal: false, path, reason: 'One side is not a KeyValues node', expected: a, actual: b };
  }

  const ea = ignoreComments ? a.entries.filter((e) => e.kind === 'pair') : a.entries;
  const eb = ignoreComments ? b.entries.filter((e) => e.kind === 'pair') : b.entries;

  if (ea.length !== eb.length) {
    return { equal: false, path, reason: `Entry count differs (${ea.length} vs ${eb.length})`, expected: ea.length, actual: eb.length };
  }

  for (let idx = 0; idx < ea.length; idx += 1) {
    const x = ea[idx];
    const y = eb[idx];
    const here = `${path} > [${idx}]`;

    if (x.kind !== y.kind) {
      return { equal: false, path: here, reason: `Entry kind differs`, expected: x.kind, actual: y.kind };
    }
    if (x.kind === 'comment') {
      if (x.text !== y.text) {
        return { equal: false, path: here, reason: 'Comment text differs', expected: x.text, actual: y.text };
      }
      continue;
    }
    if (x.key !== y.key) {
      return { equal: false, path: here, reason: 'Key differs', expected: x.key, actual: y.key };
    }
    const keyPath = `${path} > "${x.key}"`;
    const xObj = x.value instanceof KeyValues;
    const yObj = y.value instanceof KeyValues;
    if (xObj !== yObj) {
      return { equal: false, path: keyPath, reason: 'Value type differs (object vs string)', expected: xObj ? 'object' : 'string', actual: yObj ? 'object' : 'string' };
    }
    if (xObj) {
      const sub = deepEqual(x.value, y.value, { ignoreComments, path: keyPath });
      if (!sub.equal) return sub;
    } else if (x.value !== y.value) {
      return { equal: false, path: keyPath, reason: 'Value differs', expected: x.value, actual: y.value };
    }
  }

  return { equal: true };
}

/* ------------------------------------------------------------------ */
/* Integrity validation                                                */
/* ------------------------------------------------------------------ */

/**
 * Validates VDF text and reports integrity issues without throwing. Detects
 * parse failures (missing braces, invalid quotes, key-without-value, ...),
 * duplicate keys and parser warnings (unknown escapes, NUL bytes).
 *
 * @param {string} text
 * @param {object} [opts]
 * @returns {{ valid: boolean, errors: object[], warnings: object[], duplicates: object[] }}
 */
function validate(text, opts = {}) {
  const errors = [];
  const warnings = [];
  const duplicates = [];
  let root = null;

  try {
    const res = parse(text, opts);
    root = res.root;
    warnings.push(...res.warnings);
  } catch (err) {
    if (err instanceof VdfError) errors.push(err.toJSON());
    else errors.push({ name: 'Error', message: err.message });
    return { valid: false, errors, warnings, duplicates };
  }

  // Duplicate-key detection at every level.
  (function walk(node, path) {
    const seen = new Map();
    for (const e of node.entries) {
      if (e.kind !== 'pair') continue;
      if (seen.has(e.key)) {
        duplicates.push({ path, key: e.key, count: seen.get(e.key) + 1 });
        seen.set(e.key, seen.get(e.key) + 1);
      } else {
        seen.set(e.key, 1);
      }
      if (e.value instanceof KeyValues) walk(e.value, `${path} > "${e.key}"`);
    }
  })(root, '(root)');

  return { valid: errors.length === 0, errors, warnings, duplicates };
}

/* ------------------------------------------------------------------ */
/* Case-insensitive navigation helpers (Steam keys vary in casing)     */
/* ------------------------------------------------------------------ */

/**
 * Finds the actual key in a node matching `key` case-insensitively.
 * @param {KeyValues} node
 * @param {string} key
 * @returns {string|null}
 */
function findKeyCI(node, key) {
  if (!(node instanceof KeyValues)) return null;
  const lower = String(key).toLowerCase();
  for (const k of node.keys()) {
    if (k.toLowerCase() === lower) return k;
  }
  return null;
}

/**
 * Navigates (creating nested KeyValues as needed) a path of keys, tolerating
 * existing keys that differ only by case. Returns the deepest node.
 * @param {KeyValues} root
 * @param {string[]} pathKeys
 * @returns {KeyValues}
 */
function ensurePath(root, pathKeys) {
  let node = root;
  for (const seg of pathKeys) {
    const existing = findKeyCI(node, seg);
    const key = existing || seg;
    let child = node.get(key);
    if (!(child instanceof KeyValues)) {
      child = new KeyValues();
      node.set(key, child);
    }
    node = child;
  }
  return node;
}

module.exports = {
  KeyValues,
  VdfError,
  VdfParseError,
  VdfSerializeError,
  parse,
  stringify,
  tokenize,
  deepEqual,
  validate,
  findKeyCI,
  ensurePath
};
