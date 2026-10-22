#!/usr/bin/env node
// One real invocation of the existing consumer, with no dependency or URL override.
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateDocument} from '../../../skills/visual-no-slop/scripts/current-signals.mjs';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const raw=await readFile(join(root,'skills/visual-no-slop/references/current-signals.md'));
const expected=validateDocument(raw);
assert.equal(expected.freshness,'fresh','Expected reference must be current');
const cache=await mkdtemp(join(tmpdir(),'visual-no-slop-consumer-'));
try {
  const result=spawnSync(process.execPath,[join(root,'skills/visual-no-slop/scripts/current-signals.mjs'),'--cache-dir',cache],{encoding:'utf8',timeout:15000});
  assert.equal(result.status,0,result.stderr||'consumer execution failed');
  const actual=JSON.parse(result.stdout);
  assert.equal(actual.source,'remote','A bundled fallback is not a remote publication test');
  assert.equal(actual.freshness,'fresh');
  assert.equal(actual.content,expected.body,'Helper returns the validated body, excluding frontmatter');
  assert.deepEqual(actual.metadata,expected.metadata);
  console.log(JSON.stringify({passed:true,source:actual.source,refresh:actual.refresh,metadata:actual.metadata,raw_sha256:createHash('sha256').update(raw).digest('hex'),body_sha256:createHash('sha256').update(actual.content).digest('hex')}));
} finally { await rm(cache,{recursive:true,force:true}); }
