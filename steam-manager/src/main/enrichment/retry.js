/**
 * @module main/enrichment/retry
 * @description Small, dependency-free async control-flow helpers shared by the
 * Bulk Check pipeline: condition-based waiting and bounded retry with backoff.
 *
 * Design goals:
 *  - **Condition-based, not fixed sleeps.** {@link waitFor} polls a predicate
 *    and resolves the instant it becomes true, so the pipeline never blocks on
 *    an arbitrary timer longer than it must.
 *  - **Bounded + cancelable.** Every helper accepts an `AbortSignal` so a scan
 *    can be stopped cleanly; nothing loops forever ("never retry indefinitely").
 *  - **Transparent.** Each attempt can be observed via `onAttempt` for logging.
 */

'use strict';

/** @type {(ms:number, signal?:AbortSignal)=>Promise<void>} */
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new Error('aborted'));
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, Math.max(0, ms));
    function onAbort() {
      clearTimeout(t);
      reject(new Error('aborted'));
    }
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Polls `condition` until it returns truthy or the timeout elapses. Resolves as
 * soon as the condition is met (no fixed wait). The condition may be async.
 *
 * @param {() => (boolean|Promise<boolean>)} condition
 * @param {object} [opts]
 * @param {number} [opts.timeoutMs=30000] - overall budget
 * @param {number} [opts.pollMs=1000] - interval between checks
 * @param {number} [opts.stableMs=0] - the condition must hold this long before
 *   success is declared (guards against transient flickers)
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<boolean>} true if the condition was satisfied in time
 */
async function waitFor(condition, opts = {}) {
  const timeoutMs = opts.timeoutMs != null ? opts.timeoutMs : 30000;
  const pollMs = opts.pollMs != null ? opts.pollMs : 1000;
  const stableMs = opts.stableMs != null ? opts.stableMs : 0;
  const signal = opts.signal;
  const start = Date.now();
  let firstTrueAt = null;

  while (Date.now() - start < timeoutMs) {
    if (signal && signal.aborted) return false;
    let ok = false;
    try {
      ok = !!(await condition());
    } catch {
      ok = false;
    }
    if (ok) {
      if (firstTrueAt == null) firstTrueAt = Date.now();
      if (Date.now() - firstTrueAt >= stableMs) return true;
    } else {
      firstTrueAt = null;
    }
    try {
      await delay(pollMs, signal);
    } catch {
      return false; // aborted
    }
  }
  return false;
}

/**
 * Runs `fn` up to `attempts` times, waiting between failures. A "failure" is a
 * thrown error OR a result rejected by `shouldRetry`. Backoff grows the delay
 * geometrically (capped). Never loops beyond `attempts`.
 *
 * @template T
 * @param {(attempt:number) => Promise<T>|T} fn - 1-based attempt receiver
 * @param {object} [opts]
 * @param {number} [opts.attempts=3] - total tries (>= 1)
 * @param {number} [opts.delayMs=750] - base delay between tries
 * @param {number} [opts.backoff=2] - multiplier applied each retry
 * @param {number} [opts.maxDelayMs=8000] - delay cap
 * @param {(result:T)=>boolean} [opts.shouldRetry] - retry when this returns true
 * @param {(info:{attempt:number,error?:Error,result?:T,willRetry:boolean})=>void} [opts.onAttempt]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ ok:boolean, result?:T, error?:Error, attempts:number }>}
 */
async function withRetry(fn, opts = {}) {
  const attempts = Math.max(1, opts.attempts != null ? opts.attempts : 3);
  const baseDelay = opts.delayMs != null ? opts.delayMs : 750;
  const backoff = opts.backoff != null ? opts.backoff : 2;
  const maxDelay = opts.maxDelayMs != null ? opts.maxDelayMs : 8000;
  const shouldRetry = typeof opts.shouldRetry === 'function' ? opts.shouldRetry : () => false;
  const onAttempt = typeof opts.onAttempt === 'function' ? opts.onAttempt : () => {};
  const signal = opts.signal;

  let lastError;
  let lastResult;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (signal && signal.aborted) {
      return { ok: false, error: new Error('aborted'), attempts: attempt - 1 };
    }
    try {
      const result = await fn(attempt);
      lastResult = result;
      const retry = attempt < attempts && shouldRetry(result);
      onAttempt({ attempt, result, willRetry: retry });
      if (!retry) return { ok: true, result, attempts: attempt };
    } catch (error) {
      lastError = error;
      const retry = attempt < attempts;
      onAttempt({ attempt, error, willRetry: retry });
      if (!retry) return { ok: false, error, attempts: attempt };
    }

    const wait = Math.min(maxDelay, Math.round(baseDelay * Math.pow(backoff, attempt - 1)));
    try {
      await delay(wait, signal);
    } catch {
      return { ok: false, error: new Error('aborted'), attempts: attempt };
    }
  }

  // Exhausted retries after a shouldRetry-rejected result (no throw).
  return { ok: false, result: lastResult, error: lastError, attempts };
}

module.exports = { delay, waitFor, withRetry };
