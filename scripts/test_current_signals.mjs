import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { copyFile, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  CANONICAL_URL,
  MAX_DOCUMENT_BYTES,
  fetchHttpsDocument,
  parseCliArgs,
  readState,
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

function readRawState(cacheDir) {
  const database = new DatabaseSync(join(cacheDir, 'current-signals-state.sqlite'), {
    readOnly: true,
  });
  try {
    return database
      .prepare(`
        SELECT version,
          last_attempt_at AS lastAttemptAt,
          last_success_at AS lastSuccessAt,
          last_failure_at AS lastFailureAt,
          payload
        FROM current_signals_state
        WHERE id = 1`)
      .get();
  } finally {
    database.close();
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
      bundledText: uninitializedDocument(),
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

    const stateRow = readRawState(cacheDir);
    assert.match(stateRow.payload, /Second revision/);
    const database = new DatabaseSync(join(cacheDir, 'current-signals-state.sqlite'), {
      readOnly: true,
    });
    assert.equal(database.prepare('PRAGMA page_size').get().page_size, 4096);
    database.close();
    const reread = await readState(cacheDir, { now: NOW + 7 * DAY });
    assert.equal(reread.issue, null);
    assert.match(reread.state.payload, /Second revision/);
    assert.deepEqual(
      (await readdir(cacheDir)).sort(),
      ['current-signals-state.sqlite'],
      'rollback journal files must be cleaned up',
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
    const stored = readRawState(cacheDir);

    assert.equal(result.source, 'cache');
    assert.equal(result.refresh, 'failed');
    assert.equal(result.content, '# Current signals\n\nKnown good');
    assert.equal(stored.payload, knownGood);
    assert.equal(stored.lastFailureAt, new Date(NOW + 7 * DAY).toISOString());
  });
});

test('an inert remote cannot replace a still-fresh active cached revision', async () => {
  await withTempDir(async (cacheDir) => {
    const knownGood = activeDocument({
      reviewAfter: timestamp(20),
      body: '# Current signals\n\nActive known good',
    });
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
      fetcher: async () => uninitializedDocument(),
    });
    const stored = readRawState(cacheDir);

    assert.deepEqual(
      [result.source, result.status, result.content, result.refresh],
      ['cache', 'active', '# Current signals\n\nActive known good', 'fetched'],
    );
    assert.equal(stored.payload, knownGood);
    assert.equal(stored.lastSuccessAt, new Date(NOW + 7 * DAY).toISOString());
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
    assert.equal(result.detail, 'state-open-failed');
  });
});

test('a live SQLite writer is nonblocking and prevents a request', async () => {
  await withTempDir(async (cacheDir) => {
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => activeDocument(),
    });
    const database = new DatabaseSync(join(cacheDir, 'current-signals-state.sqlite'));
    database.exec('PRAGMA busy_timeout = 0; BEGIN IMMEDIATE');
    try {
      let fetches = 0;
      const result = await runConsumer({
        now: NOW + 7 * DAY,
        cacheDir,
        bundledText: uninitializedDocument(),
        fetcher: async () => {
          fetches += 1;
          return activeDocument({ updated: timestamp(7) });
        },
      });
      assert.equal(fetches, 0);
      assert.equal(result.source, 'cache');
      assert.equal(result.refresh, 'lock-contended');
      assert.equal(result.detail, 'state-busy');
    } finally {
      database.exec('ROLLBACK');
      database.close();
    }
  });
});

test('three simultaneous contenders permit one fetch and one committed writer', async () => {
  await withTempDir(async (cacheDir) => {
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => activeDocument(),
    });

    let fetches = 0;
    let signalStarted;
    let releaseFetch;
    const started = new Promise((resolveStarted) => {
      signalStarted = resolveStarted;
    });
    const gate = new Promise((resolveFetch) => {
      releaseFetch = resolveFetch;
    });
    const first = runConsumer({
      now: NOW + 7 * DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => {
        fetches += 1;
        signalStarted();
        await gate;
        return activeDocument({ updated: timestamp(7), body: '# Current signals\n\nWinner' });
      },
    });
    await started;
    const [second, third] = await Promise.all([
      runConsumer({
        now: NOW + 7 * DAY,
        cacheDir,
        bundledText: uninitializedDocument(),
        fetcher: async () => {
          fetches += 1;
          return activeDocument({ updated: timestamp(7) });
        },
      }),
      runConsumer({
        now: NOW + 7 * DAY,
        cacheDir,
        bundledText: uninitializedDocument(),
        fetcher: async () => {
          fetches += 1;
          return activeDocument({ updated: timestamp(7) });
        },
      }),
    ]);
    releaseFetch();
    const winner = await first;

    assert.equal(fetches, 1);
    assert.equal(winner.refresh, 'fetched');
    assert.deepEqual([second.refresh, third.refresh], ['lock-contended', 'lock-contended']);
    assert.match(readRawState(cacheDir).payload, /Winner/);
  });
});

test('an exited writer is rolled back by SQLite and does not leave an abandoned lock', async () => {
  await withTempDir(async (cacheDir) => {
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => activeDocument(),
    });
    const path = join(cacheDir, 'current-signals-state.sqlite');
    const child = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { DatabaseSync } from 'node:sqlite';
         const db = new DatabaseSync(process.argv[1]);
         db.exec('PRAGMA busy_timeout=0; BEGIN IMMEDIATE');
         db.prepare('UPDATE current_signals_state SET payload = ? WHERE id = 1').run('uncommitted');
         process.exit(0);`,
        path,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(child.status, 0, child.stderr);

    const result = await runConsumer({
      now: NOW + 7 * DAY,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () =>
        activeDocument({ updated: timestamp(7), body: '# Current signals\n\nRecovered' }),
    });
    assert.equal(result.refresh, 'fetched');
    assert.match(readRawState(cacheDir).payload, /Recovered/);
  });
});

test('future and corrupt state cannot suppress a due refresh', async () => {
  await withTempDir(async (cacheDir) => {
    await runConsumer({
      now: NOW,
      cacheDir,
      bundledText: uninitializedDocument(),
      fetcher: async () => activeDocument(),
    });
    const path = join(cacheDir, 'current-signals-state.sqlite');
    let database = new DatabaseSync(path);
    database
      .prepare(`
        UPDATE current_signals_state
        SET last_attempt_at = ?, last_success_at = ?, last_failure_at = NULL
        WHERE id = 1`)
      .run(timestamp(1), timestamp(1));
    database.close();
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

    database = new DatabaseSync(path);
    database
      .prepare('UPDATE current_signals_state SET payload = ? WHERE id = 1')
      .run('malformed cached payload');
    database.close();
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

test('CLI runs through a symlinked path and emits its offline JSON result', async () => {
  const current = Date.now();
  const body = '# Current signals\n\nSynthetic active CLI fixture';
  const cases = [
    {
      name: 'uninitialized',
      bundled: uninitializedDocument(),
      expected: ['uninitialized', 'bundled', 'uninitialized', null],
    },
    {
      name: 'active',
      bundled: activeDocument({
        updated: new Date(current - 60_000).toISOString(),
        reviewAfter: new Date(current + DAY).toISOString(),
        body,
      }),
      expected: ['active', 'bundled', 'fresh', body],
    },
  ];
  for (const fixture of cases) {
    await withTempDir(async (directory) => {
      // Exercise real CLI/symlink resolution against explicit bundled states.
      // The evolving research reference must not determine this test's outcome.
      const scripts = join(directory, 'package', 'scripts');
      const references = join(directory, 'package', 'references');
      await mkdir(scripts, { recursive: true });
      await mkdir(references, { recursive: true });
      const target = join(scripts, 'current-signals.mjs');
      await copyFile(resolve('skills/visual-no-slop/scripts/current-signals.mjs'), target);
      await writeFile(join(references, 'current-signals.md'), fixture.bundled);
      const alias = join(directory, 'signals-alias.mjs');
      await symlink(target, alias);
      const result = spawnSync(
        process.execPath,
        [alias, '--offline', '--cache-dir', join(directory, 'cache')],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.notEqual(result.stdout.trim(), '');
      const output = JSON.parse(result.stdout);
      assert.deepEqual(
        [output.status, output.source, output.freshness, output.content],
        fixture.expected,
        fixture.name,
      );
    });
  }
});
