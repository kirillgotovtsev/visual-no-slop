#!/usr/bin/env node

import { TextDecoder } from 'node:util';
import { homedir, platform } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import { DatabaseSync } from 'node:sqlite';
import { chmod, mkdir, open, realpath, stat } from 'node:fs/promises';

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

const STATE_VERSION = 1;
const STATE_FILE = 'current-signals-state.sqlite';
const MAX_DATABASE_BYTES = 512 * 1024;
const MAX_DATABASE_PAGES = 128;
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

const CREATE_STATE_TABLE = `
  CREATE TABLE IF NOT EXISTS current_signals_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL CHECK (version = 1),
    last_attempt_at TEXT,
    last_success_at TEXT,
    last_failure_at TEXT,
    payload TEXT,
    CHECK (payload IS NULL OR length(CAST(payload AS BLOB)) <= ${MAX_DOCUMENT_BYTES})
  )`;

const READ_STATE = `
  SELECT version, last_attempt_at, last_success_at, last_failure_at, payload
  FROM current_signals_state
  WHERE id = 1`;

const WRITE_STATE = `
  INSERT INTO current_signals_state (
    id, version, last_attempt_at, last_success_at, last_failure_at, payload
  ) VALUES (1, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    version = excluded.version,
    last_attempt_at = excluded.last_attempt_at,
    last_success_at = excluded.last_success_at,
    last_failure_at = excluded.last_failure_at,
    payload = excluded.payload`;

function isBusyError(error) {
  return error?.errcode === 5 || error?.errcode === 6;
}

function configureDatabase(database) {
  database.exec(`
    PRAGMA busy_timeout = 0;
    PRAGMA journal_mode = DELETE;
    PRAGMA synchronous = FULL;
    PRAGMA temp_store = MEMORY;
    PRAGMA trusted_schema = OFF;
    PRAGMA page_size = 4096;
  `);
  const pageSize = database.prepare('PRAGMA page_size').get().page_size;
  if (pageSize !== 4096) throw new Error('Unsupported cache database page size');
  const maxPages = database
    .prepare(`PRAGMA max_page_count = ${MAX_DATABASE_PAGES}`)
    .get().max_page_count;
  if (maxPages !== MAX_DATABASE_PAGES) {
    throw new Error('Could not apply the cache database size limit');
  }
}

function stateFromRow(row, nowMs) {
  if (!row) return { state: null, issue: null };
  if (row.version !== STATE_VERSION) throw new Error('Unknown state schema');
  if (row.payload !== null && typeof row.payload !== 'string') {
    throw new Error('payload must be a string or null');
  }
  if (row.payload !== null && Buffer.byteLength(row.payload, 'utf8') > MAX_DOCUMENT_BYTES) {
    throw new Error('payload is too large');
  }
  const issues = [];
  const state = {
    version: STATE_VERSION,
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    payload: row.payload,
    lastAttemptMs: parseStateTimestamp(row.last_attempt_at, nowMs, 'lastAttemptAt', issues),
    lastSuccessMs: parseStateTimestamp(row.last_success_at, nowMs, 'lastSuccessAt', issues),
    lastFailureMs: parseStateTimestamp(row.last_failure_at, nowMs, 'lastFailureAt', issues),
  };
  return { state, issue: issues[0] ?? null };
}

function readStateFromDatabase(database, nowMs) {
  return stateFromRow(database.prepare(READ_STATE).get(), nowMs);
}

export async function readState(cacheDir, options = {}) {
  const nowMs = toNowMs(options.now);
  const path = join(cacheDir, STATE_FILE);
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_DATABASE_BYTES) {
      return { state: null, issue: 'state-read-failed' };
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: null, issue: null };
    return { state: null, issue: 'state-read-failed' };
  }

  let database;
  try {
    database = new DatabaseSync(path, { readOnly: true });
    database.exec('PRAGMA busy_timeout = 0; PRAGMA query_only = ON;');
    return readStateFromDatabase(database, nowMs);
  } catch (error) {
    return {
      state: null,
      issue: isBusyError(error) ? 'state-busy' : 'state-invalid',
    };
  } finally {
    database?.close();
  }
}

function writeStateToDatabase(database, state) {
  if (state.payload !== null && Buffer.byteLength(state.payload, 'utf8') > MAX_DOCUMENT_BYTES) {
    throw new Error('payload is too large');
  }
  database
    .prepare(WRITE_STATE)
    .run(
      STATE_VERSION,
      state.lastAttemptAt,
      state.lastSuccessAt,
      state.lastFailureAt,
      state.payload,
    );
}

async function beginStateTransaction(cacheDir, nowMs) {
  const path = join(cacheDir, STATE_FILE);
  let database;
  try {
    await mkdir(cacheDir, { recursive: true, mode: 0o700 });
    try {
      const info = await stat(path);
      if (!info.isFile() || info.size > MAX_DATABASE_BYTES) {
        throw new Error('Cache database exceeds its size limit');
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    database = new DatabaseSync(path);
    await chmod(path, 0o600);
    configureDatabase(database);
    database.exec('BEGIN IMMEDIATE');
    database.exec(CREATE_STATE_TABLE);
    let stateRead;
    try {
      stateRead = readStateFromDatabase(database, nowMs);
    } catch {
      stateRead = { state: null, issue: 'state-invalid' };
    }
    return {
      database,
      stateRead,
    };
  } catch (error) {
    try {
      database?.exec('ROLLBACK');
    } catch {}
    database?.close();
    return {
      database: null,
      stateRead: null,
      issue: isBusyError(error) ? 'state-busy' : 'state-open-failed',
    };
  }
}

function finishStateTransaction(transaction, commit) {
  if (!transaction.database) return;
  try {
    transaction.database.exec(commit ? 'COMMIT' : 'ROLLBACK');
  } finally {
    transaction.database.close();
    transaction.database = null;
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

function chooseCandidate(first, second) {
  if (!first) return second;
  if (!second) return first;
  if (first.document.status !== second.document.status) {
    return first.document.status === 'active' ? first : second;
  }
  if (first.document.status === 'active') {
    const firstUpdated = Date.parse(first.document.metadata.updated_at);
    const secondUpdated = Date.parse(second.document.metadata.updated_at);
    if (secondUpdated > firstUpdated) {
      return second;
    }
  }
  return first;
}

function fallbackOutput(cached, bundled, refresh, detail, cacheIssue) {
  const selected = chooseCandidate(
    cached ? { document: cached, source: 'cache' } : null,
    bundled ? { document: bundled, source: 'bundled' } : null,
  );
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

function stateForSuccess(raw, nowMs) {
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

  const transaction = await beginStateTransaction(cacheDir, nowMs);
  if (!transaction.database) {
    stateRead = await readState(cacheDir, { now: nowMs });
    cached = validatedCached(stateRead.state, nowMs);
    return fallbackOutput(
      cached.document,
      bundle.document,
      transaction.issue === 'state-busy' ? 'lock-contended' : 'write-failed',
      transaction.issue,
      stateRead.issue ?? cached.issue ?? bundle.issue,
    );
  }

  let transactionFinished = false;
  try {
    stateRead = transaction.stateRead;
    cached = validatedCached(stateRead.state, nowMs);
    const lockedDecision = refreshDecision(
      stateForRefreshDecision(stateRead.state, cached.structurallyValid),
      nowMs,
    );
    if (lockedDecision !== 'due') {
      finishStateTransaction(transaction, false);
      transactionFinished = true;
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
        writeStateToDatabase(transaction.database, failure);
        finishStateTransaction(transaction, true);
        transactionFinished = true;
      } catch {
        if (!transactionFinished) {
          finishStateTransaction(transaction, false);
          transactionFinished = true;
        }
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

    const selectedStored = chooseCandidate(
      { document: remote, source: 'remote' },
      cached.document ? { document: cached.document, source: 'cache' } : null,
    );
    try {
      writeStateToDatabase(
        transaction.database,
        stateForSuccess(selectedStored.document.raw, nowMs),
      );
      finishStateTransaction(transaction, true);
      transactionFinished = true;
    } catch {
      if (!transactionFinished) {
        finishStateTransaction(transaction, false);
        transactionFinished = true;
      }
      return fallbackOutput(
        cached.document,
        bundle.document,
        'write-failed',
        'cache-write-failed',
        stateRead.issue ?? cached.issue ?? bundle.issue,
      );
    }
    const selectedOutput = chooseCandidate(
      selectedStored,
      bundle.document ? { document: bundle.document, source: 'bundled' } : null,
    );
    return outputFor(
      selectedOutput.document,
      selectedOutput.source,
      'fetched',
      null,
      stateRead.issue,
    );
  } finally {
    if (!transactionFinished) finishStateTransaction(transaction, false);
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

async function isCliEntry() {
  if (!process.argv[1]) return false;
  try {
    return (
      (await realpath(resolve(process.argv[1]))) ===
      (await realpath(fileURLToPath(import.meta.url)))
    );
  } catch {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (await isCliEntry()) {
  await main();
}
