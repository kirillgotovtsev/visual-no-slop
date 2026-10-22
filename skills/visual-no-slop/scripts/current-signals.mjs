#!/usr/bin/env node

import { TextDecoder } from 'node:util';
import { randomBytes } from 'node:crypto';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import {
  mkdir,
  open,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';

export const CANONICAL_URL =
  'https://raw.githubusercontent.com/kirillgotovtsev/visual-no-slop/main/skills/visual-no-slop/references/current-signals.md';
export const SOURCE_REPOSITORY =
  'https://github.com/kirillgotovtsev/visual-no-slop';
export const MAX_DOCUMENT_BYTES = 96 * 1024;
export const MAX_SIGNAL_COUNT = 1000;
export const REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const FAILURE_BACKOFF_MS = 24 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 10_000;
// Five minutes covers small host clock drift without making future revisions current indefinitely.
export const CLOCK_SKEW_MS = 5 * 60 * 1000;
export const LOCK_ABANDONED_MS = 60_000;

const STATE_VERSION = 1;
const MAX_STATE_BYTES = MAX_DOCUMENT_BYTES * 2 + 16 * 1024;
const STATE_FILE = 'current-signals-state.json';
const LOCK_FILE = 'current-signals.lock';
const EXPECTED_KEYS = new Set([
  'schema_version',
  'status',
  'updated_at',
  'review_after',
  'source_repository',
  'signal_count',
]);
const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const bundledPath = fileURLToPath(
  new URL('../references/current-signals.md', import.meta.url),
);

export class SignalsValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SignalsValidationError';
    this.code = code;
  }
}

function validationError(code, message) {
  throw new SignalsValidationError(code, message);
}

function decodeDocument(input, maxBytes = MAX_DOCUMENT_BYTES) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  if (bytes.byteLength > maxBytes) {
    validationError('document-too-large', `Document exceeds ${maxBytes} bytes`);
  }
  try {
    return { text: utf8.decode(bytes), bytes: bytes.byteLength };
  } catch {
    validationError('invalid-utf8', 'Document is not valid UTF-8');
  }
}

function parseTimestamp(value, field) {
  const match = TIMESTAMP_RE.exec(value);
  if (!match) {
    validationError('invalid-timestamp', `${field} must be a UTC Z RFC3339 timestamp`);
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ''] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(fraction.padEnd(3, '0'));
  if (year < 1970) {
    validationError('invalid-timestamp', `${field} is outside the supported range`);
  }
  const valueMs = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const parsed = new Date(valueMs);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day ||
    parsed.getUTCHours() !== hour ||
    parsed.getUTCMinutes() !== minute ||
    parsed.getUTCSeconds() !== second ||
    parsed.getUTCMilliseconds() !== millisecond
  ) {
    validationError('invalid-timestamp', `${field} is not a real calendar timestamp`);
  }
  return valueMs;
}

function parseFrontmatter(text) {
  if (text.includes('\0') || /\r(?!\n)/.test(text)) {
    validationError('invalid-document', 'Document contains unsupported characters');
  }
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') {
    validationError('missing-frontmatter', 'Document must begin with frontmatter');
  }
  const closing = lines.indexOf('---', 1);
  if (closing < 0) {
    validationError('missing-frontmatter', 'Frontmatter has no closing delimiter');
  }
  const metadataLines = lines.slice(1, closing);
  const values = Object.create(null);
  for (const line of metadataLines) {
    const match = /^([a-z_]+): (\S(?:.*\S)?)$/.exec(line);
    if (!match) {
      validationError('unsupported-yaml', 'Only one-line unquoted scalar values are supported');
    }
    const [, key, value] = match;
    if (!EXPECTED_KEYS.has(key)) {
      validationError('unknown-metadata-key', `Unknown frontmatter key: ${key}`);
    }
    if (Object.hasOwn(values, key)) {
      validationError('duplicate-metadata-key', `Duplicate frontmatter key: ${key}`);
    }
    values[key] = value;
  }
  if (metadataLines.length !== EXPECTED_KEYS.size) {
    validationError('metadata-key-count', 'Frontmatter must contain exactly six keys');
  }
  for (const key of EXPECTED_KEYS) {
    if (!Object.hasOwn(values, key)) {
      validationError('missing-metadata-key', `Missing frontmatter key: ${key}`);
    }
  }

  return {
    values,
    body: lines.slice(closing + 1).join('\n').trim(),
  };
}

export function validateDocument(input, options = {}) {
  const nowMs = toNowMs(options.now);
  const { text, bytes } = decodeDocument(input);
  const { values, body } = parseFrontmatter(text);

  if (values.schema_version !== '1') {
    validationError('schema-version', 'schema_version must be 1');
  }
  if (values.status !== 'uninitialized' && values.status !== 'active') {
    validationError('invalid-status', 'status must be uninitialized or active');
  }
  if (values.source_repository !== SOURCE_REPOSITORY) {
    validationError('source-repository', 'source_repository does not match the canonical repository');
  }
  if (!/^(?:0|[1-9]\d*)$/.test(values.signal_count)) {
    validationError('invalid-signal-count', 'signal_count must be a nonnegative integer');
  }
  const signalCount = Number(values.signal_count);
  if (!Number.isSafeInteger(signalCount) || signalCount > MAX_SIGNAL_COUNT) {
    validationError('invalid-signal-count', `signal_count must not exceed ${MAX_SIGNAL_COUNT}`);
  }

  if (values.status === 'uninitialized') {
    if (
      values.updated_at !== 'null' ||
      values.review_after !== 'null' ||
      signalCount !== 0
    ) {
      validationError(
        'invalid-uninitialized',
        'uninitialized requires null dates and signal_count 0',
      );
    }
    return {
      raw: text,
      body: null,
      bytes,
      status: 'uninitialized',
      freshness: 'uninitialized',
      metadata: {
        schema_version: 1,
        status: 'uninitialized',
        updated_at: null,
        review_after: null,
        source_repository: SOURCE_REPOSITORY,
        signal_count: 0,
      },
    };
  }

  if (values.updated_at === 'null' || values.review_after === 'null') {
    validationError('missing-active-dates', 'active requires both timestamps');
  }
  const updatedAtMs = parseTimestamp(values.updated_at, 'updated_at');
  const reviewAfterMs = parseTimestamp(values.review_after, 'review_after');
  if (updatedAtMs > nowMs + CLOCK_SKEW_MS) {
    validationError('future-updated-at', 'updated_at is too far in the future');
  }
  if (reviewAfterMs <= updatedAtMs) {
    validationError('invalid-review-window', 'review_after must be later than updated_at');
  }

  return {
    raw: text,
    body,
    bytes,
    status: 'active',
    freshness: reviewAfterMs > nowMs ? 'fresh' : 'expired',
    metadata: {
      schema_version: 1,
      status: 'active',
      updated_at: values.updated_at,
      review_after: values.review_after,
      source_repository: SOURCE_REPOSITORY,
      signal_count: signalCount,
    },
  };
}

function toNowMs(now) {
  const value = now instanceof Date ? now.getTime() : now ?? Date.now();
  if (!Number.isFinite(value)) {
    throw new TypeError('now must be a Date or finite epoch milliseconds');
  }
  return value;
}

function iso(nowMs) {
  return new Date(nowMs).toISOString();
}

export function defaultCacheDir(env = process.env, os = platform()) {
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'visual-no-slop');
  }
  if (os === 'win32') {
    return join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'visual-no-slop');
  }
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'visual-no-slop');
}

async function readLimitedFile(path, maxBytes) {
  const handle = await open(path, 'r');
  try {
    const chunks = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(16 * 1024, maxBytes + 1 - total));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBytes) {
        throw Object.assign(new Error(`File exceeds ${maxBytes} bytes`), {
          code: 'FILE_TOO_LARGE',
        });
      }
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally {
    await handle.close();
  }
}

function parseStateTimestamp(value, nowMs, field, issues) {
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`);
  }
  let valueMs;
  try {
    valueMs = parseTimestamp(value, field);
  } catch {
    throw new Error(`${field} is invalid`);
  }
  if (valueMs > nowMs + CLOCK_SKEW_MS) {
    issues.push(`future-${field}`);
    return null;
  }
  return valueMs;
}

export async function readState(cacheDir, options = {}) {
  const nowMs = toNowMs(options.now);
  const path = join(cacheDir, STATE_FILE);
  let bytes;
  try {
    bytes = await readLimitedFile(path, MAX_STATE_BYTES);
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: null, issue: null };
    return { state: null, issue: 'state-read-failed' };
  }

  try {
    const text = utf8.decode(bytes);
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('State must be an object');
    }
    const allowed = new Set([
      'version',
      'lastAttemptAt',
      'lastSuccessAt',
      'lastFailureAt',
      'payload',
    ]);
    if (
      Object.keys(parsed).length !== allowed.size ||
      Object.keys(parsed).some((key) => !allowed.has(key)) ||
      [...allowed].some((key) => !Object.hasOwn(parsed, key)) ||
      parsed.version !== STATE_VERSION
    ) {
      throw new Error('Unknown state schema');
    }
    if (parsed.payload !== null && typeof parsed.payload !== 'string') {
      throw new Error('payload must be a string or null');
    }
    if (
      parsed.payload !== null &&
      Buffer.byteLength(parsed.payload, 'utf8') > MAX_DOCUMENT_BYTES
    ) {
      throw new Error('payload is too large');
    }
    const issues = [];
    const state = {
      version: STATE_VERSION,
      lastAttemptAt: parsed.lastAttemptAt ?? null,
      lastSuccessAt: parsed.lastSuccessAt ?? null,
      lastFailureAt: parsed.lastFailureAt ?? null,
      payload: parsed.payload ?? null,
      lastAttemptMs: parseStateTimestamp(
        parsed.lastAttemptAt ?? null,
        nowMs,
        'lastAttemptAt',
        issues,
      ),
      lastSuccessMs: parseStateTimestamp(
        parsed.lastSuccessAt ?? null,
        nowMs,
        'lastSuccessAt',
        issues,
      ),
      lastFailureMs: parseStateTimestamp(
        parsed.lastFailureAt ?? null,
        nowMs,
        'lastFailureAt',
        issues,
      ),
    };
    return { state, issue: issues[0] ?? null };
  } catch {
    return { state: null, issue: 'state-invalid' };
  }
}

function serializeState(state) {
  const serializable = {
    version: STATE_VERSION,
    lastAttemptAt: state.lastAttemptAt,
    lastSuccessAt: state.lastSuccessAt,
    lastFailureAt: state.lastFailureAt,
    payload: state.payload,
  };
  const text = `${JSON.stringify(serializable)}\n`;
  if (Buffer.byteLength(text, 'utf8') > MAX_STATE_BYTES) {
    throw new Error('Serialized state exceeds its size limit');
  }
  return text;
}

export async function writeStateAtomic(cacheDir, state) {
  await mkdir(cacheDir, { recursive: true, mode: 0o700 });
  const target = join(cacheDir, STATE_FILE);
  const temporary = join(
    cacheDir,
    `.${STATE_FILE}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
  );
  try {
    await writeFile(temporary, serializeState(state), {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

function createLockToken() {
  return randomBytes(16).toString('hex');
}

async function tryCreateLock(lockPath, nowMs, token) {
  const handle = await open(lockPath, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify({ token, createdAt: iso(nowMs) })}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}

async function inspectLock(lockPath) {
  const handle = await open(lockPath, 'r');
  try {
    const info = await handle.stat();
    const buffer = Buffer.alloc(513);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    let token = null;
    if (bytesRead <= 512) {
      try {
        const parsed = JSON.parse(utf8.decode(buffer.subarray(0, bytesRead)));
        if (parsed && /^[a-f0-9]{32}$/.test(parsed.token)) token = parsed.token;
      } catch {
        // Invalid stale locks remain recoverable by age; fresh ones remain protected.
      }
    }
    return { dev: info.dev, ino: info.ino, mtimeMs: info.mtimeMs, token };
  } finally {
    await handle.close();
  }
}

async function restoreClaimedLock(claimPath, lockPath) {
  let bytes;
  try {
    bytes = await readLimitedFile(claimPath, 512);
  } catch {
    await unlink(claimPath).catch(() => {});
    return;
  }
  let handle;
  try {
    handle = await open(lockPath, 'wx', 0o600);
    await handle.writeFile(bytes);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  } finally {
    await handle?.close();
    await unlink(claimPath).catch(() => {});
  }
}

export async function acquireLock(cacheDir, options = {}) {
  const nowMs = toNowMs(options.now);
  const lockPath = join(cacheDir, LOCK_FILE);
  const token = createLockToken();
  try {
    await mkdir(cacheDir, { recursive: true, mode: 0o700 });
  } catch {
    return { acquired: false, recovered: false, reason: 'lock-error', path: lockPath };
  }
  try {
    await tryCreateLock(lockPath, nowMs, token);
    return { acquired: true, recovered: false, path: lockPath, token };
  } catch (error) {
    if (error?.code !== 'EEXIST') {
      return { acquired: false, recovered: false, reason: 'lock-error', path: lockPath };
    }
  }

  let candidate;
  try {
    candidate = await inspectLock(lockPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      try {
        await tryCreateLock(lockPath, nowMs, token);
        return { acquired: true, recovered: false, path: lockPath, token };
      } catch (createError) {
        return {
          acquired: false,
          recovered: false,
          reason: createError?.code === 'EEXIST' ? 'lock-contended' : 'lock-error',
          path: lockPath,
        };
      }
    }
    return { acquired: false, recovered: false, reason: 'lock-error', path: lockPath };
  }
  const age = nowMs - candidate.mtimeMs;
  const abandoned = age > LOCK_ABANDONED_MS || age < -CLOCK_SKEW_MS;
  if (!abandoned) {
    return { acquired: false, recovered: false, reason: 'lock-contended', path: lockPath };
  }

  await options.afterStaleStat?.();
  const claimPath = join(cacheDir, `.${LOCK_FILE}.${token}.stale`);
  try {
    await rename(lockPath, claimPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      try {
        await tryCreateLock(lockPath, nowMs, token);
        return { acquired: true, recovered: true, path: lockPath, token };
      } catch (createError) {
        return {
          acquired: false,
          recovered: false,
          reason: createError?.code === 'EEXIST' ? 'lock-contended' : 'lock-error',
          path: lockPath,
        };
      }
    }
    return {
      acquired: false,
      recovered: false,
      reason: 'lock-error',
      path: lockPath,
    };
  }

  try {
    const claimed = await inspectLock(claimPath);
    if (claimed.dev !== candidate.dev || claimed.ino !== candidate.ino) {
      await restoreClaimedLock(claimPath, lockPath);
      return {
        acquired: false,
        recovered: false,
        reason: 'lock-contended',
        path: lockPath,
      };
    }
    await unlink(claimPath);
    await tryCreateLock(lockPath, nowMs, token);
    return { acquired: true, recovered: true, path: lockPath, token };
  } catch (error) {
    await restoreClaimedLock(claimPath, lockPath).catch(() => {});
    return {
      acquired: false,
      recovered: false,
      reason: error?.code === 'EEXIST' ? 'lock-contended' : 'lock-error',
      path: lockPath,
    };
  }
}

export async function releaseLock(lock) {
  if (lock?.acquired) {
    try {
      const current = await inspectLock(lock.path);
      if (current.token === lock.token) await unlink(lock.path);
    } catch {
      // A missing or replaced lock is no longer owned by this caller.
    }
  }
}

export function refreshDecision(state, now = Date.now()) {
  const nowMs = toNowMs(now);
  if (
    state?.lastSuccessMs !== null &&
    state?.lastSuccessMs !== undefined &&
    nowMs - state.lastSuccessMs >= 0 &&
    nowMs - state.lastSuccessMs < REFRESH_INTERVAL_MS
  ) {
    return 'cache-hit';
  }
  if (
    state?.lastFailureMs !== null &&
    state?.lastFailureMs !== undefined &&
    nowMs - state.lastFailureMs >= 0 &&
    nowMs - state.lastFailureMs < FAILURE_BACKOFF_MS
  ) {
    return 'backoff';
  }
  return 'due';
}

function safeValidate(input, nowMs) {
  if (input === null || input === undefined) {
    return { document: null, issue: null, structurallyValid: false };
  }
  try {
    const document = validateDocument(input, { now: nowMs });
    if (document.freshness === 'expired') {
      return { document: null, issue: 'expired', structurallyValid: true };
    }
    return { document, issue: null, structurallyValid: true };
  } catch (error) {
    return {
      document: null,
      issue: error instanceof SignalsValidationError ? error.code : 'invalid-document',
      structurallyValid: false,
    };
  }
}

function outputFor(document, source, refresh, detail = null, cacheIssue = null) {
  if (!document) {
    return {
      status: 'unavailable',
      source: 'none',
      freshness: 'unavailable',
      content: null,
      metadata: null,
      refresh,
      detail,
      cache_issue: cacheIssue,
    };
  }
  return {
    status: document.status,
    source,
    freshness: document.freshness,
    content: document.status === 'active' ? document.body : null,
    metadata: document.metadata,
    refresh,
    detail,
    cache_issue: cacheIssue,
  };
}

function chooseFallback(cached, bundled) {
  if (!cached) return bundled ? { document: bundled, source: 'bundled' } : null;
  if (!bundled) return { document: cached, source: 'cache' };
  if (cached.status !== bundled.status) {
    return cached.status === 'active'
      ? { document: cached, source: 'cache' }
      : { document: bundled, source: 'bundled' };
  }
  if (cached.status === 'active') {
    const cachedUpdated = Date.parse(cached.metadata.updated_at);
    const bundledUpdated = Date.parse(bundled.metadata.updated_at);
    if (bundledUpdated > cachedUpdated) {
      return { document: bundled, source: 'bundled' };
    }
  }
  return { document: cached, source: 'cache' };
}

function fallbackOutput(cached, bundled, refresh, detail, cacheIssue) {
  const selected = chooseFallback(cached, bundled);
  if (selected) {
    return outputFor(selected.document, selected.source, refresh, detail, cacheIssue);
  }
  return outputFor(null, 'none', refresh, detail, cacheIssue);
}

export function fetchHttpsDocument(options = {}) {
  const url = options.url ?? CANONICAL_URL;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_DOCUMENT_BYTES;
  const requestImpl = options.requestImpl ?? https.get;

  if (url !== CANONICAL_URL) {
    return Promise.reject(new Error('Only the canonical current-signals URL is allowed'));
  }

  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const request = requestImpl(
      url,
      {
        headers: {
          accept: 'text/markdown,text/plain;q=0.9',
          'user-agent': 'visual-no-slop-current-signals/1',
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400) {
          response.destroy();
          finish(rejectPromise, new Error('Redirects are not allowed'));
          return;
        }
        if (response.statusCode !== 200) {
          response.destroy();
          finish(rejectPromise, new Error(`Unexpected HTTP status ${response.statusCode}`));
          return;
        }
        const chunks = [];
        let total = 0;
        response.on('data', (chunk) => {
          if (settled) return;
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          total += bytes.byteLength;
          if (total > maxBytes) {
            response.destroy(new Error('Remote document exceeds the size limit'));
            return;
          }
          chunks.push(bytes);
        });
        response.on('end', () => {
          if (total > maxBytes) {
            finish(rejectPromise, new Error('Remote document exceeds the size limit'));
          } else {
            finish(resolvePromise, Buffer.concat(chunks, total));
          }
        });
        response.on('error', (error) => finish(rejectPromise, error));
      },
    );
    const timer = setTimeout(() => {
      request.destroy(new Error('Current-signals request timed out'));
    }, timeoutMs);
    request.on('error', (error) => finish(rejectPromise, error));
  });
}

async function loadBundled(path, provided, nowMs) {
  if (provided !== undefined) return safeValidate(provided, nowMs);
  try {
    return safeValidate(await readLimitedFile(path, MAX_DOCUMENT_BYTES), nowMs);
  } catch {
    return { document: null, issue: 'bundled-read-failed' };
  }
}

function validatedCached(state, nowMs) {
  return safeValidate(state?.payload ?? null, nowMs);
}

function stateForRefreshDecision(state, cachedPayloadIsValid) {
  if (!state || cachedPayloadIsValid) return state;
  return { ...state, lastSuccessMs: null };
}

function stateForSuccess(state, raw, nowMs) {
  return {
    version: STATE_VERSION,
    lastAttemptAt: iso(nowMs),
    lastSuccessAt: iso(nowMs),
    lastFailureAt: null,
    payload: raw,
  };
}

function stateForFailure(state, nowMs) {
  return {
    version: STATE_VERSION,
    lastAttemptAt: iso(nowMs),
    lastSuccessAt: state?.lastSuccessAt ?? null,
    lastFailureAt: iso(nowMs),
    payload: state?.payload ?? null,
  };
}

export async function runConsumer(options = {}) {
  const nowMs = toNowMs(options.now);
  const cacheDir = resolve(options.cacheDir ?? defaultCacheDir());
  const offline = options.offline === true;
  const fetcher = options.fetcher ?? ((fetchOptions) => fetchHttpsDocument(fetchOptions));
  const bundle = await loadBundled(
    options.bundledPath ?? bundledPath,
    options.bundledText,
    nowMs,
  );
  let stateRead = await readState(cacheDir, { now: nowMs });
  let cached = validatedCached(stateRead.state, nowMs);

  if (offline) {
    return fallbackOutput(
      cached.document,
      bundle.document,
      'offline',
      null,
      stateRead.issue ?? cached.issue ?? bundle.issue,
    );
  }

  const decision = refreshDecision(
    stateForRefreshDecision(stateRead.state, cached.structurallyValid),
    nowMs,
  );
  if (decision !== 'due') {
    return fallbackOutput(
      cached.document,
      bundle.document,
      decision,
      null,
      stateRead.issue ?? cached.issue ?? bundle.issue,
    );
  }

  const lock = await acquireLock(cacheDir, { now: nowMs });
  if (!lock.acquired) {
    stateRead = await readState(cacheDir, { now: nowMs });
    cached = validatedCached(stateRead.state, nowMs);
    return fallbackOutput(
      cached.document,
      bundle.document,
      lock.reason === 'lock-error' ? 'write-failed' : 'lock-contended',
      lock.reason,
      stateRead.issue ?? cached.issue ?? bundle.issue,
    );
  }

  try {
    stateRead = await readState(cacheDir, { now: nowMs });
    cached = validatedCached(stateRead.state, nowMs);
    const lockedDecision = refreshDecision(
      stateForRefreshDecision(stateRead.state, cached.structurallyValid),
      nowMs,
    );
    if (lockedDecision !== 'due') {
      return fallbackOutput(
        cached.document,
        bundle.document,
        lockedDecision,
        null,
        stateRead.issue ?? cached.issue ?? bundle.issue,
      );
    }

    let remote;
    let remoteIssue = null;
    try {
      const fetched = await fetcher({
        url: CANONICAL_URL,
        timeoutMs: REQUEST_TIMEOUT_MS,
        maxBytes: MAX_DOCUMENT_BYTES,
      });
      const checked = safeValidate(fetched, nowMs);
      remote = checked.document;
      remoteIssue = checked.issue;
      if (!remote) throw new Error(remoteIssue || 'remote-invalid');
    } catch {
      const failure = stateForFailure(stateRead.state, nowMs);
      try {
        await writeStateAtomic(cacheDir, failure);
      } catch {
        return fallbackOutput(
          cached.document,
          bundle.document,
          'write-failed',
          'cache-write-failed',
          stateRead.issue ?? cached.issue ?? bundle.issue,
        );
      }
      return fallbackOutput(
        cached.document,
        bundle.document,
        'failed',
        remoteIssue ? `remote-${remoteIssue}` : 'remote-unavailable',
        stateRead.issue ?? cached.issue ?? bundle.issue,
      );
    }

    try {
      await writeStateAtomic(cacheDir, stateForSuccess(stateRead.state, remote.raw, nowMs));
    } catch {
      return fallbackOutput(
        cached.document,
        bundle.document,
        'write-failed',
        'cache-write-failed',
        stateRead.issue ?? cached.issue ?? bundle.issue,
      );
    }
    return outputFor(
      remote,
      'remote',
      lock.recovered ? 'fetched-after-lock-recovery' : 'fetched',
      null,
      stateRead.issue,
    );
  } finally {
    await releaseLock(lock);
  }
}

export function parseCliArgs(argv) {
  const options = { offline: false, cacheDir: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--offline') {
      options.offline = true;
    } else if (argument === '--cache-dir') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--cache-dir requires a path');
      }
      options.cacheDir = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

async function main() {
  try {
    const result = await runConsumer(parseCliArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({
        status: 'unavailable',
        source: 'none',
        freshness: 'unavailable',
        content: null,
        metadata: null,
        refresh: 'argument-error',
        detail: error?.message || 'Invalid arguments',
        cache_issue: null,
      })}\n`,
    );
    process.exitCode = 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
