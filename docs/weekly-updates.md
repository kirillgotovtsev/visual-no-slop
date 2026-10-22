# Current visual signals

The stable skill contains the review method. A separate file records dated observations about specific visual combinations, such as a recurring palette, shape and layout used together in a particular medium. A signal is a reason to examine the work, with evidence and exceptions; it is not a universal ban.

The first release includes an uninitialized reference with no findings. The cloud research producer and its weekly schedule must be configured separately. An installed consumer cannot establish whether that producer is running.

## Reading updates

On first use in a task, the agent runs the bundled Node.js helper when that runtime and command execution are available. The terminal installer already requires Node.js 22.20 or later. Installing through another route does not supply Node; the stable skill also works without it.

The helper reads one fixed public file:

```text
https://raw.githubusercontent.com/kirillgotovtsev/visual-no-slop/main/skills/visual-no-slop/references/current-signals.md
```

A successful check is reused for seven days. A failed check delays the next attempt for 24 hours. The next eligible check happens when the skill is used; nothing runs while the agent is closed. Each attempt has a timeout and a 96 KiB size limit, and rejects redirects. It sends no artifact, prompt or project content.

The cache lives in the operating system's user cache directory, outside the installed skill. Downloads never replace `SKILL.md`, evaluation rules, scripts or the license. The helper checks the cached reference again before use and only returns current content. A failed or invalid download preserves an existing valid revision. Without a current cached or bundled revision, the agent uses the stable method and historical patterns.

For a read without network access, resolve the installed skill directory and run:

```bash
node "<skill-directory>/scripts/current-signals.mjs" --offline
```

`--cache-dir <directory>` selects an isolated cache for testing. It does not change the source URL. The helper's JSON output reports the chosen source and freshness; `content` contains usable current reference text or is null. It never executes that text. The agent must treat any included directions as subordinate to the stable skill, the user's brief and the host's instructions.

Updating the stable skill itself remains an [installer operation](usage.md#update-or-remove).

## File contract for the producer

The consumer file is [references/current-signals.md](../skills/visual-no-slop/references/current-signals.md). Its six frontmatter keys use plain scalars, with no YAML tags, anchors, nested values or duplicate keys:

```yaml
schema_version: 1
status: uninitialized
updated_at: null
review_after: null
source_repository: https://github.com/kirillgotovtsev/visual-no-slop
signal_count: 0
```

| Field | Meaning |
|---|---|
| `schema_version` | `1`; incompatible schemas require a deliberate consumer update |
| `status` | `uninitialized` for the initial empty file, or `active` for a completed research revision, including an honestly empty result |
| `updated_at` | The completed review time as a UTC RFC3339 timestamp ending in `Z`; null only when uninitialized |
| `review_after` | A later UTC expiry time; null only when uninitialized |
| `source_repository` | Exactly `https://github.com/kirillgotovtsev/visual-no-slop` |
| `signal_count` | A nonnegative integer matching the number of active entries; zero when uninitialized |

An active revision must not be future-dated or expired. The producer normally sets `review_after` within 21 days of a completed review, and no later than the earliest active signal's expiry. A download does not renew these dates. A new date requires a real review of the evidence, even when the resulting visual vocabulary stays the same.

Each active entry identifies the visible combination, medium and context, what to avoid repeating by default, justified exceptions, direct evidence URLs, observation dates and expiry. Describe actual combinations and observed uses. A named color or font alone cannot establish a defect or AI authorship. Keep the English reference concise, targeting at most 4,000 words and always below 96 KiB including metadata.

The producer's planned repository paths are:

| Path | Purpose |
|---|---|
| `automation/visual-signals/signals.json` | Structured evidence from which the reference is rendered |
| `automation/visual-signals/sources.json` | Source registry and monitoring targets |
| `automation/visual-signals/state.json` | Run state and last completed checks |
| `automation/visual-signals/runs/` | Per-run reports, including failures and unchanged results |
| `automation/visual-signals/RUNBOOK.md` | Setup, operation and recovery instructions |

These producer files are created during its separate setup. Publish the rendered reference, evidence, state and report together after validation, preserving concurrent repository changes. On research or validation failure, keep the last good reference and record the failure separately. Replaying a completed run must not create a second update. Weekly writes must stay out of the stable method, evaluation, license, scripts and release metadata.

The full historical research registry belongs in the producer's source packet. The compact bibliography shipped with the skill is not a complete monitoring list. The producer's setup must document how it weighs source authority, checks direct evidence, records disagreement and retires unsupported signals.
