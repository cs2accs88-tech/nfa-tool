/**
 * @module utils/vdfFile
 * @description Robust file I/O for VDF (Steam KeyValues) files, built on top of
 * {@link module:utils/steamVdf}. Provides:
 *   - Binary-safe reads with strict UTF-8 + BOM validation.
 *   - Atomic writes (write to a temp file, fsync, then rename over the target)
 *     so a crash mid-write can never truncate or corrupt the real file.
 *   - Post-write validation: the file is re-read, re-parsed and deep-compared
 *     against the in-memory tree; any divergence is reported with exact
 *     location, expected and actual values.
 *   - Verbose, structured debug logging (path, sizes, durations, warnings,
 *     errors) via an injectable logger.
 *   - Detailed errors: every failure names the function, the file and (when
 *     applicable) the line/column plus a suggested fix.
 *
 * Dependency-free apart from Node core, so it is unit-testable without Electron.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse, stringify, deepEqual, VdfError } = require('./steamVdf');

const UTF8_BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

/** A logger that does nothing (default). */
const NOOP_LOGGER = { debug() {}, info() {}, warn() {}, error() {} };

/**
 * Creates a console-backed logger with a component prefix.
 * @param {string} [component='vdfFile']
 * @returns {{debug:Function, info:Function, warn:Function, error:Function}}
 */
function createConsoleLogger(component = 'vdfFile') {
  const stamp = () => new Date().toISOString();
  const fmt = (lvl, args) => `[${stamp()}] [${lvl}] [${component}] ` +
    args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  return {
    debug: (...a) => console.log(fmt('DEBUG', a)),
    info: (...a) => console.log(fmt('INFO', a)),
    warn: (...a) => console.warn(fmt('WARN', a)),
    error: (...a) => console.error(fmt('ERROR', a))
  };
}

/**
 * Validates a buffer as UTF-8 and returns the offset of the first invalid byte,
 * or -1 if the whole buffer is valid UTF-8. Rejects overlong encodings,
 * surrogates and out-of-range code points.
 * @param {Buffer} buf
 * @returns {number}
 */
function firstInvalidUtf8Offset(buf) {
  const n = buf.length;
  let i = 0;
  while (i < n) {
    const b = buf[i];
    if (b <= 0x7f) { i += 1; continue; }
    let extra;
    let min;
    let cp;
    if ((b & 0xe0) === 0xc0) { extra = 1; min = 0x80; cp = b & 0x1f; }
    else if ((b & 0xf0) === 0xe0) { extra = 2; min = 0x800; cp = b & 0x0f; }
    else if ((b & 0xf8) === 0xf0) { extra = 3; min = 0x10000; cp = b & 0x07; }
    else return i; // invalid leading byte (incl. lone continuation / 0xF8+)
    if (i + extra >= n) return i; // truncated multi-byte sequence
    for (let j = 1; j <= extra; j += 1) {
      const c = buf[i + j];
      if ((c & 0xc0) !== 0x80) return i; // bad continuation byte
      cp = (cp << 6) | (c & 0x3f);
    }
    if (cp < min) return i; // overlong encoding
    if (cp > 0x10ffff) return i; // beyond Unicode
    if (cp >= 0xd800 && cp <= 0xdfff) return i; // UTF-16 surrogate half
    i += extra + 1;
  }
  return -1;
}

/**
 * Converts a character offset in `text` to a 1-based line/column.
 * @param {string} text
 * @param {number} offset
 * @returns {{line:number, column:number}}
 */
function offsetToLineCol(text, offset) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text[i] === '\n') { line += 1; col = 1; } else { col += 1; }
  }
  return { line, column: col };
}

/**
 * Reads and parses a VDF file safely.
 *
 * @param {string} filePath
 * @param {object} [opts]
 * @param {object} [opts.logger]
 * @param {number} [opts.maxDepth]
 * @returns {{ root: import('./steamVdf').KeyValues, text: string, warnings: object[],
 *             stats: { sizeBytes:number, hadBom:boolean, parseMs:number } }}
 */
function readVdfFile(filePath, opts = {}) {
  const log = opts.logger || NOOP_LOGGER;
  let buffer;
  try {
    buffer = fs.readFileSync(filePath); // Buffer (binary) — never text mode.
  } catch (err) {
    throw new VdfError(`Failed to read file: ${err.message}`, {
      fn: 'readVdfFile', file: filePath,
      suggestion: err.code === 'ENOENT'
        ? 'The file does not exist. Check the path.'
        : 'Check read permissions and that the path is a file, not a directory.'
    });
  }

  const sizeBytes = buffer.length;
  log.debug('read', { file: filePath, sizeBytes });

  // Strip and record a UTF-8 BOM if present.
  let hadBom = false;
  let body = buffer;
  if (buffer.length >= 3 && buffer[0] === UTF8_BOM[0] && buffer[1] === UTF8_BOM[1] && buffer[2] === UTF8_BOM[2]) {
    hadBom = true;
    body = buffer.subarray(3);
  }

  // Strict UTF-8 validation with a precise byte offset.
  const badAt = firstInvalidUtf8Offset(body);
  if (badAt !== -1) {
    throw new VdfError('File is not valid UTF-8', {
      fn: 'readVdfFile', file: filePath, offset: badAt + (hadBom ? 3 : 0),
      suggestion: `Byte ${badAt + (hadBom ? 3 : 0)} is not valid UTF-8. Re-export the file as UTF-8.`
    });
  }

  const text = body.toString('utf8');

  const t0 = process.hrtime.bigint();
  let result;
  try {
    result = parse(text, { maxDepth: opts.maxDepth });
  } catch (err) {
    if (err instanceof VdfError) {
      err.file = filePath; // enrich with the file path
      log.error('parse failed', err.toJSON ? err.toJSON() : { message: err.message });
    }
    throw err;
  }
  const parseMs = Number(process.hrtime.bigint() - t0) / 1e6;

  if (result.warnings.length) log.warn('parser warnings', { file: filePath, count: result.warnings.length, warnings: result.warnings });
  log.debug('parsed', { file: filePath, parseMs: Number(parseMs.toFixed(3)), hadBom });

  return { root: result.root, text, warnings: result.warnings, stats: { sizeBytes, hadBom, parseMs } };
}

/**
 * Synchronous sleep (used only for short rename retries on Windows where AV
 * software may briefly lock the target file).
 * @param {number} ms
 */
function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* busy wait fallback */ }
  }
}

/**
 * Renames `from` onto `to`, retrying briefly on transient Windows lock errors.
 * On modern Node, rename replaces an existing destination atomically.
 * @param {string} from
 * @param {string} to
 * @param {object} log
 */
function renameWithRetry(from, to, log) {
  const transient = new Set(['EPERM', 'EACCES', 'EBUSY']);
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      attempt += 1;
      if (transient.has(err.code) && attempt <= 5) {
        log.warn('rename retry', { from, to, code: err.code, attempt });
        sleepSync(40 * attempt);
        continue;
      }
      throw new VdfError(`Atomic replace failed: ${err.message}`, {
        fn: 'renameWithRetry', file: to,
        suggestion: 'Close any program (e.g. Steam) holding the file open, then retry.'
      });
    }
  }
}

/**
 * Serializes and atomically writes a KeyValues tree to disk, then validates the
 * written file by re-reading and deep-comparing it against the in-memory tree.
 *
 * @param {string} filePath
 * @param {import('./steamVdf').KeyValues} kv
 * @param {object} [opts]
 * @param {object} [opts.logger]
 * @param {boolean} [opts.validateAfterWrite=true]
 * @param {boolean} [opts.bom=false] - prepend a UTF-8 BOM
 * @param {string} [opts.eol='\n']
 * @param {string} [opts.indent='\t']
 * @returns {{ bytesWritten:number, sizeBefore:(number|null), serializeMs:number,
 *             validateMs:number, validated:boolean }}
 */
function writeVdfFile(filePath, kv, opts = {}) {
  const log = opts.logger || NOOP_LOGGER;
  const validateAfterWrite = opts.validateAfterWrite !== false;

  // Size before (for logging / diagnostics).
  let sizeBefore = null;
  try { sizeBefore = fs.statSync(filePath).size; } catch { sizeBefore = null; }

  // Serialize (timed).
  const s0 = process.hrtime.bigint();
  let text;
  try {
    text = stringify(kv, { eol: opts.eol, indent: opts.indent });
  } catch (err) {
    if (err instanceof VdfError) { err.file = filePath; log.error('serialize failed', err.toJSON()); }
    throw err;
  }
  const serializeMs = Number(process.hrtime.bigint() - s0) / 1e6;

  let outBuf = Buffer.from(text, 'utf8');
  if (opts.bom) outBuf = Buffer.concat([UTF8_BOM, outBuf]);

  // Guard: serializer must never emit NUL bytes.
  if (outBuf.indexOf(0x00) !== -1) {
    throw new VdfError('Serialized output unexpectedly contains a NUL byte', {
      fn: 'writeVdfFile', file: filePath, suggestion: 'This is a serializer bug — report it. No file was written.'
    });
  }

  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);

  // Atomic write: temp file -> fsync -> rename over target.
  let fd;
  try {
    fd = fs.openSync(tmp, 'w'); // create/truncate temp
    fs.writeSync(fd, outBuf, 0, outBuf.length, 0);
    fs.fsyncSync(fd); // flush to disk before rename
  } catch (err) {
    try { if (fd !== undefined) fs.closeSync(fd); } catch { /* ignore */ }
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw new VdfError(`Failed to write temp file: ${err.message}`, {
      fn: 'writeVdfFile', file: tmp,
      suggestion: 'Check write permissions and free disk space in the target directory.'
    });
  } finally {
    try { if (fd !== undefined) fs.closeSync(fd); } catch { /* ignore */ }
  }

  try {
    renameWithRetry(tmp, filePath, log);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw err;
  }

  const bytesWritten = outBuf.length;
  log.debug('wrote', { file: filePath, sizeBefore, bytesWritten, serializeMs: Number(serializeMs.toFixed(3)) });

  // Post-write validation: reload and deep-compare.
  let validateMs = 0;
  if (validateAfterWrite) {
    const v0 = process.hrtime.bigint();
    let reread;
    try {
      reread = readVdfFile(filePath, { logger: NOOP_LOGGER });
    } catch (err) {
      throw new VdfError(`Post-write validation failed to re-read the file: ${err.message}`, {
        fn: 'writeVdfFile', file: filePath,
        suggestion: 'The written file could not be parsed back — the on-disk data may be corrupt.'
      });
    }
    const cmp = deepEqual(kv, reread.root);
    validateMs = Number(process.hrtime.bigint() - v0) / 1e6;

    if (!cmp.equal) {
      log.error('post-write mismatch', cmp);
      throw new VdfError('Post-write validation mismatch: file on disk differs from in-memory tree', {
        fn: 'writeVdfFile', file: filePath,
        suggestion: `At ${cmp.path}: ${cmp.reason}. Expected ${JSON.stringify(cmp.expected)}, ` +
          `got ${JSON.stringify(cmp.actual)}. This indicates a serialize/parse defect.`
      });
    }
    log.debug('validated', { file: filePath, validateMs: Number(validateMs.toFixed(3)) });
  }

  return {
    bytesWritten,
    sizeBefore,
    serializeMs: Number(serializeMs.toFixed(3)),
    validateMs: Number(validateMs.toFixed(3)),
    validated: validateAfterWrite
  };
}

module.exports = {
  readVdfFile,
  writeVdfFile,
  firstInvalidUtf8Offset,
  offsetToLineCol,
  createConsoleLogger,
  UTF8_BOM
};
