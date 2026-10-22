import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  CANONICAL_URL,
  MAX_DOCUMENT_BYTES,
  acquireLock,
  fetchHttpsDocument,
  parseCliArgs,
  readState,
  releaseLock,
  runConsumer,
  validateDocument,
} from '../skills/visual-no-slop/scripts/current-signals.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-23T12:00:00Z');

function timestamp(offsetDays) {
  return new Date(NOW + offsetDays * DAY).toISOString().replace('.000Z', 'Z');
}

function activeDocument({
  updated = timestamp(-1),
  reviewAfter = timestamp(30),
  count = 1,
  body = '# Current signals\n\nSignal A',
  extraLines = [],
} = {}) {
  return [
    '---',
    'schema_version: 1',
    'status: active',
    `updated_at: ${updated}`,
    `review_after: ${reviewAfter}`,
    'source_repository: https://github.com/kirillgotovtsev/visual-no-slop',
    `signal_count: ${count}`,
    ...extraLines,
    '---',
    '',
    body,
    '',
  ].join('\n');
}

function uninitializedDocument() {
  return [
    '---',
    'schema_version: 1',
    'status: uninitialized',
    'updated_at: null',
    'review_after: null',
    'source_repository: https://github.com/kirillgotovtsev/visual-no-slop',
    'signal_count: 0',
    '---',
    '',
    '# Current signals',
    '',
    'No researched revision has been published.',
    '',
  ].join('\n');
}

async function withTempDir(run) {
  const directory = await mkdtemp(join(tmpdir(), 'visual-no-slop-signals-'));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('validates the exact active metadata contract and returns only its body', () => {
  const checked = validateDocument(activeDocument(), { now: NOW });
  assert.equal(checked.status, 'active');
  assert.equal(checked.freshness, 'fresh');
  assert.equal(checked.metadata.signal_count, 1);
  assert.equal(checked.body, '# Current signals\n\nSignal A');
});

test('rejects stale, future, malformed, oversized, duplicate, unknown, and missing metadata', () => {
  const duplicate = activeDocument().replace('status: active', 'schema_version: 1');
  const unknown = activeDocument().replace('status: active', 'owner: producer');
  const missing = activeDocument().replace('signal_count: 1\n', '');
  const malformed = activeDocument().replace('schema_version: 1', 'schema_version: "1"');
  const future = activeDocument({ updated: timestamp(1) });
  const stale = activeDocument({ reviewAfter: timestamp(-0.5) });
  const oversized = activeDocument({ body: 'x'.repeat(MAX_DOCUMENT_BYTES) });
  const invalidUtf8 = Buffer.from([0xff, 0xfe, 0xfd]);

  assert.throws(() => validateDocument(duplicate, { now: NOW }), /Duplicate frontmatter key/);
  assert.throws(() => validateDocument(unknown, { now: NOW }), /Unknown frontmatter key/);
  assert.throws(() => validateDocument(missing, { now: NOW }), /exactly six keys/);
  assert.throws(() => validateDocument(malformed, { now: NOW }), /schema_version must be 1/);
  assert.throws(() => validateDocument(future, { now: NOW }), /too far in the future/);
  assert.equal(validateDocument(stale, { now: NOW }).freshness, 'expired');
  assert.throws(() => validateDocument(oversized, { now: NOW }), /exceeds/);
  assert.throws(() => validateDocument(invalidUtf8, { now: NOW }), /valid UTF-8/);
});

test('accepts uninitialized as inert and never exposes its body', async () => {
  await withTempDir(async (cacheDir) => {
    let fetches = 0;
    const first = await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: activeDocument(),
      fetcher: async () => {
        fetches += 1;
        return uninitializedDocument();
      },
    });
    const second = await runConsumer({
      now: NOW + DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        throw new Error('must not fetch within the weekly window');
      },
    });

    assert.equal(fetches, 1);
    assert.deepEqual(
      [first.status, first.freshness, first.content],
      ['uninitialized', 'uninitialized', null],
    );
    assert.equal(second.source, 'cache');
    assert.equal(second.content, null);
  });
});

test('fetches once, writes an atomic state, and uses the cache until seven days pass', async () => {
  await withTempDir(async (cacheDir) => {
    let fetches = 0;
    const firstBody = '# Current signals\n\nFirst revision';
    const secondBody = '# Current signals\n\nSecond revision';
    const first = await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async ({ url }) => {
        assert.equal(url, CANONICAL_URL);
        fetches += 1;
        return activeDocument({ body: firstBody });
      },
    });
    const hit = await runConsumer({
      now: NOW + DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        throw new Error('unexpected request');
      },
    });
    const refreshed = await runConsumer({
      now: NOW + 7 * DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument({ updated: timestamp(7), body: secondBody });
      },
    });

    assert.equal(fetches, 2);
    assert.deepEqual([first.source, first.refresh, first.content], ['remote', 'fetched', firstBody]);
    assert.deepEqual([hit.source, hit.refresh, hit.content], ['cache', 'cache-hit', firstBody]);
    assert.deepEqual(
      [refreshed.source, refreshed.refresh, refreshed.content],
      ['remote', 'fetched', secondBody],
    );

    const stateText = await readFile(join(cacheDir, 'current-signals-state.json'), 'utf8');
    const stateJson = JSON.parse(stateText);
    assert.match(stateJson.payload, /Second revision/);
    const reread = await readState(cacheDir, { now: NOW + 7 * DAY });
    assert.equal(reread.issue, null);
    assert.match(reread.state.payload, /Second revision/);
    assert.deepEqual(
      (await readdir(cacheDir)).sort(),
      ['current-signals-state.json'],
      'atomic temp and lock files must be cleaned up',
    );
  });
});

test('an expired but structurally valid payload keeps the weekly check cadence', async () => {
  await withTempDir(async (cacheDir) => {
    let fetches = 0;
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument({ reviewAfter: timestamp(2) });
      },
    });
    const expired = await runConsumer({
      now: NOW + 3 * DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        throw new Error('must not refresh before seven days');
      },
    });
    const refreshed = await runConsumer({
      now: NOW + 7 * DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument({ updated: timestamp(7), reviewAfter: timestamp(30) });
      },
    });

    assert.equal(fetches, 2);
    assert.deepEqual(
      [expired.source, expired.refresh, expired.content],
      ['bundled', 'cache-hit', null],
    );
    assert.deepEqual([refreshed.source, refreshed.refresh], ['remote', 'fetched']);
  });
});

test('backs off failed network requests for 24 hours', async () => {
  await withTempDir(async (cacheDir) => {
    let fetches = 0;
    const failure = async () => {
      fetches += 1;
      throw new Error('network unavailable');
    };
    const first = await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: activeDocument(),
      fetcher: failure,
    });
    const backoff = await runConsumer({
      now: NOW + 23 * 60 * 60 * 1000,
      cacheDir,
      bundledText: activeDocument(),
      fetcher: failure,
    });
    const retry = await runConsumer({
      now: NOW + DAY,
      cacheDir,
      bundledText: activeDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument({ updated: timestamp(1) });
      },
    });

    assert.equal(fetches, 2);
    assert.deepEqual([first.source, first.refresh], ['bundled', 'failed']);
    assert.deepEqual([backoff.source, backoff.refresh], ['bundled', 'backoff']);
    assert.deepEqual([retry.source, retry.refresh], ['remote', 'fetched']);
  });
});

test('preserves a still-fresh known-good payload when the new remote is stale', async () => {
  await withTempDir(async (cacheDir) => {
    const knownGood = activeDocument({ body: '# Current signals\n\nKnown good' });
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => knownGood,
    });
    const result = await runConsumer({
      now: NOW + 7 * DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () =>
        activeDocument({
          updated: timestamp(-10),
          reviewAfter: timestamp(6),
          body: '# Current signals\n\nStale replacement',
        }),
    });
    const stored = JSON.parse(
      await readFile(join(cacheDir, 'current-signals-state.json'), 'utf8'),
    );

    assert.equal(result.source, 'cache');
    assert.equal(result.refresh, 'failed');
    assert.equal(result.content, '# Current signals\n\nKnown good');
    assert.equal(stored.payload, knownGood);
    assert.equal(stored.lastFailureAt, new Date(NOW + 7 * DAY).toISOString());
  });
});

test('offline mode never fetches and selects revalidated cache then bundled data', async () => {
  await withTempDir(async (cacheDir) => {
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => activeDocument({ body: '# Current signals\n\nCached' }),
    });
    let fetches = 0;
    const cached = await runConsumer({
      now: NOW + DAY,
      offline: true,
      cacheDir,
      bundledText: activeDocument({ body: '# Current signals\n\nBundled' }),
      fetcher: async () => {
        fetches += 1;
      },
    });
    const bundled = await runConsumer({
      now: NOW,
      offline: true,
      cacheDir: join(cacheDir, 'empty'),
      bundledText: activeDocument({ body: '# Current signals\n\nBundled' }),
      fetcher: async () => {
        fetches += 1;
      },
    });

    assert.equal(fetches, 0);
    assert.deepEqual([cached.source, cached.refresh], ['cache', 'offline']);
    assert.deepEqual([bundled.source, bundled.refresh], ['bundled', 'offline']);
  });
});

test('fresh active bundled data outranks inert or older cached data', async () => {
  await withTempDir(async (cacheDir) => {
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => uninitializedDocument(),
    });
    const activeBundle = await runConsumer({
      now: NOW + DAY,
      offline: true,
      cacheDir,
      bundledText: activeDocument({
        updated: timestamp(0),
        body: '# Current signals\n\nActive bundle',
      }),
    });
    assert.deepEqual(
      [activeBundle.source, activeBundle.status, activeBundle.content],
      ['bundled', 'active', '# Current signals\n\nActive bundle'],
    );

    const olderCacheDir = join(cacheDir, 'older-cache');
    await runConsumer({
      now: NOW,
      cacheDir: olderCacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () =>
        activeDocument({
          updated: timestamp(-2),
          body: '# Current signals\n\nOlder cache',
        }),
    });
    const newerBundle = await runConsumer({
      now: NOW + DAY,
      offline: true,
      cacheDir: olderCacheDir,
      bundledText: activeDocument({
        updated: timestamp(0),
        body: '# Current signals\n\nNewer bundle',
      }),
    });
    assert.deepEqual(
      [newerBundle.source, newerBundle.content],
      ['bundled', '# Current signals\n\nNewer bundle'],
    );
  });
});

test('filesystem cache failure returns an explicit bundled fallback without fetching', async () => {
  await withTempDir(async (directory) => {
    const cacheDir = join(directory, 'not-a-directory');
    await writeFile(cacheDir, 'occupied');
    let fetches = 0;
    const result = await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: activeDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument();
      },
    });

    assert.equal(fetches, 0);
    assert.equal(result.source, 'bundled');
    assert.equal(result.refresh, 'write-failed');
    assert.equal(result.detail, 'lock-error');
  });
});

test('a live concurrency lock is nonblocking and prevents a request', async () => {
  await withTempDir(async (cacheDir) => {
    await mkdir(cacheDir, { recursive: true });
    const lockPath = join(cacheDir, 'current-signals.lock');
    await writeFile(lockPath, `${timestamp(0)}\n`);
    const current = new Date(NOW);
    await utimes(lockPath, current, current);
    let fetches = 0;
    const result = await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: activeDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument();
      },
    });

    assert.equal(fetches, 0);
    assert.equal(result.source, 'bundled');
    assert.equal(result.refresh, 'lock-contended');
  });
});

test('an abandoned lock is recovered once and removed after a successful refresh', async () => {
  await withTempDir(async (cacheDir) => {
    await mkdir(cacheDir, { recursive: true });
    const lockPath = join(cacheDir, 'current-signals.lock');
    await writeFile(lockPath, 'abandoned\n');
    const old = new Date(NOW - 120_000);
    await utimes(lockPath, old, old);
    const result = await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => activeDocument(),
    });

    assert.equal(result.refresh, 'fetched-after-lock-recovery');
    assert.deepEqual(await readdir(cacheDir), ['current-signals-state.json']);
  });
});

test('simultaneous stale-lock contenders produce exactly one owner', async () => {
  await withTempDir(async (cacheDir) => {
    const lockPath = join(cacheDir, 'current-signals.lock');
    await writeFile(lockPath, 'abandoned\n');
    const old = new Date(NOW - 120_000);
    await utimes(lockPath, old, old);

    let arrivals = 0;
    let openBarrier;
    const barrier = new Promise((resolveBarrier) => {
      openBarrier = resolveBarrier;
    });
    const afterStaleStat = async () => {
      arrivals += 1;
      if (arrivals === 2) openBarrier();
      await barrier;
    };
    const contenders = await Promise.all([
      acquireLock(cacheDir, { now: NOW, afterStaleStat }),
      acquireLock(cacheDir, { now: NOW, afterStaleStat }),
    ]);
    const owners = contenders.filter((lock) => lock.acquired);

    assert.equal(arrivals, 2);
    assert.equal(owners.length, 1);
    assert.equal(contenders.filter((lock) => lock.reason === 'lock-contended').length, 1);
    await releaseLock(owners[0]);
    assert.deepEqual(await readdir(cacheDir), []);
  });
});

test('release never removes a lock whose owner token has changed', async () => {
  await withTempDir(async (cacheDir) => {
    const first = await acquireLock(cacheDir, { now: NOW });
    assert.equal(first.acquired, true);
    await rm(first.path);
    const second = await acquireLock(cacheDir, { now: NOW });
    assert.equal(second.acquired, true);
    const current = new Date(NOW);
    await utimes(second.path, current, current);

    await releaseLock(first);
    const observer = await acquireLock(cacheDir, { now: NOW });
    assert.equal(observer.acquired, false);
    assert.equal(observer.reason, 'lock-contended');
    await releaseLock(second);
  });
});

test('future and corrupt state cannot suppress a due refresh', async () => {
  await withTempDir(async (cacheDir) => {
    await mkdir(cacheDir, { recursive: true });
    const path = join(cacheDir, 'current-signals-state.json');
    await writeFile(
      path,
      `${JSON.stringify({
        version: 1,
        lastAttemptAt: timestamp(1),
        lastSuccessAt: timestamp(1),
        lastFailureAt: null,
        payload: activeDocument(),
      })}\n`,
    );
    let fetches = 0;
    const future = await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument({ body: '# Current signals\n\nAfter rollback' });
      },
    });
    assert.equal(future.source, 'remote');
    assert.equal(fetches, 1);

    await writeFile(path, '{not json');
    const corrupt = await runConsumer({
      now: NOW + DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        return activeDocument({ updated: timestamp(1) });
      },
    });
    assert.equal(corrupt.source, 'remote');
    assert.equal(fetches, 2);
  });
});

test('HTTPS reader rejects redirects, enforces the stream cap, and has a total timeout', async () => {
  function fakeRequest(statusCode, chunks = [], delay = 0) {
    return (_url, _options, callback) => {
      const request = new EventEmitter();
      request.destroy = (error) => queueMicrotask(() => request.emit('error', error));
      setTimeout(() => {
        const response = new PassThrough();
        response.statusCode = statusCode;
        callback(response);
        for (const chunk of chunks) response.write(chunk);
        response.end();
      }, delay);
      return request;
    };
  }

  await assert.rejects(
    fetchHttpsDocument({ requestImpl: fakeRequest(302), timeoutMs: 100 }),
    /Redirects are not allowed/,
  );
  let rejectedResponse;
  const endlessErrorBody = (_url, _options, callback) => {
    const request = new EventEmitter();
    request.destroy = (error) => queueMicrotask(() => request.emit('error', error));
    queueMicrotask(() => {
      rejectedResponse = new PassThrough();
      rejectedResponse.statusCode = 503;
      callback(rejectedResponse);
      rejectedResponse.write('partial error body');
    });
    return request;
  };
  await assert.rejects(
    fetchHttpsDocument({ requestImpl: endlessErrorBody, timeoutMs: 100 }),
    /Unexpected HTTP status 503/,
  );
  assert.equal(rejectedResponse.destroyed, true);
  await assert.rejects(
    fetchHttpsDocument({
      requestImpl: fakeRequest(200, [Buffer.alloc(17)]),
      maxBytes: 16,
      timeoutMs: 100,
    }),
    /size limit/,
  );

  const neverResponds = () => {
    const request = new EventEmitter();
    request.destroy = (error) => queueMicrotask(() => request.emit('error', error));
    return request;
  };
  await assert.rejects(
    fetchHttpsDocument({ requestImpl: neverResponds, timeoutMs: 5 }),
    /timed out/,
  );
});

test('CLI accepts only offline and cache-dir options', () => {
  assert.deepEqual(parseCliArgs(['--offline', '--cache-dir', '/tmp/example']), {
    offline: true,
    cacheDir: '/tmp/example',
  });
  assert.throws(() => parseCliArgs(['--url', 'https://example.com']), /Unknown argument/);
  assert.throws(() => parseCliArgs(['--cache-dir']), /requires a path/);
});

test('lock helper reports a newly acquired lock for deterministic callers', async () => {
  await withTempDir(async (cacheDir) => {
    const lock = await acquireLock(cacheDir, { now: NOW });
    assert.equal(lock.acquired, true);
    await releaseLock(lock);
  });
});
