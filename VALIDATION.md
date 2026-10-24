# Validation

Release **1.4.0**, prepared on 23 October 2026. This release adds portable
installation guides, explicit runtime requirements and a skill-only ZIP built
from the same source as the full and plugin packages.

## Post-release Meatlook journey check — 25 October 2026

The [journey check](docs/meatlook-journey-check-2026-10-25.md) covers the README
homepage route, both service-specific skill routes, form initialization and
client-side validation. No enquiry was submitted. It distinguishes working
navigation from attribution gaps and unverified server delivery. This is
post-release evidence, not a change to the published 1.4.0 archives or a
measurement of conversion.

## Version 1.4.0 checks

Ruby Psych parses the skill frontmatter. It uses only standard Agent Skills
fields, with a 194-character description and a 292-character compatibility
statement. The skill and plugin share the version, official homepage and source.
The package checker also verifies the repository's controlled metadata format,
license identity and local reference closure; it is not a general YAML parser.

The release builder passes nine focused tests covering all three ZIP layouts,
exact file content, identical skill bytes across packages, reproducibility,
source preservation, output collisions, unsafe paths and corrupted archives.
The tests use an isolated Git fixture and do not touch user installations.

The review method, personal-review rules, licenses, visual examples, current
reference and producer files are preserved from commit `e3853c2`. The consumer
code and its existing tests are unchanged. The earlier behavioral and visual
checks remain historical evidence for those files; this release does not claim
new native automatic activation or equivalent outcomes in different hosts.

Public CLI checks used `skills` 1.7.4 and Node.js 24.19.0 on macOS, with
telemetry disabled and isolated project directories. Four version 1.3.2 copies
were installed before publication of the 1.4.0 candidate, then replaced from
GitHub. Four additional copies were installed fresh. Every installed skill
contained eleven files matching the release source by SHA-256.

| Target | Fresh installation and listing | Replacement from 1.3.2 | Offline helper and removal |
|---|---|---|---|
| Codex | Passed in `.agents/skills/visual-no-slop/` | `skills update` passed | Passed; no skill path remained |
| Claude Code | Passed in `.claude/skills/visual-no-slop/` | Targeted `skills add -a claude-code` passed; generic update left the old copy | Passed; no skill path remained |
| Cursor | Passed in `.agents/skills/visual-no-slop/` | `skills update` passed | Passed; no skill path remained |
| GitHub Copilot | Passed in `.agents/skills/visual-no-slop/` | `skills update` passed | Passed; no skill path remained |

The generic Claude Code update exited successfully while preserving the old
agent copy and placing the new version in `.agents`. Repeating installation
with the explicit Claude target replaced the actual agent copy. The
[usage guide](docs/usage.md#update-or-remove) documents this verified route.

The commands exercised with the cached `skills` 1.7.4 executable were:

```text
skills add kirillgotovtsev/visual-no-slop --skill visual-no-slop -a <agent> -y --json
skills list -a <agent> --json
skills update visual-no-slop --project
skills remove visual-no-slop -y
```

For the Claude replacement, the first command was repeated with
`-a claude-code`. The checks inspected actual installed file content, not only
the CLI's exit status or listing. They did not launch the target applications.

The skill-only ZIP has one `visual-no-slop/` root; its eleven files match the
source and the skill files in the other two archives. Its extracted helper
returned the bundled active reference offline, fetched the canonical reference
online and used the cache on the next invocation. These are standalone Node
checks, not native host invocation tests. Source-bound package checks and the
builder verify the exact archive contents and their SHA-256 checksums.

An independent review found no blockers in the changed packaging, metadata,
runtime instructions or documented installation routes; it independently ran
the nine archive tests and reviewed the Claude replacement receipts. The
[compatibility table](docs/compatibility.md#verification-evidence) records
these automated checks alongside the author's confirmation of native use.

On 23 October 2026, after publication, Kirill Gotovtsev confirmed use of version
1.4.0 in Claude Code, Cursor and GitHub Copilot, and import of the skill ZIP
into Claude. Plugin-host installation and user-wide CLI placement remain
separate verification tasks.

## Version 1.3.2 checks

The package checker passes. Ruby Psych parses the skill frontmatter, and its
version matches the plugin manifest. The skill-creator validator could not run
in the available Python environment because PyYAML is absent; no dependency was
installed for it. All eleven files in the updated user installation match the
source by SHA-256, with the previous installation preserved for rollback.

An independent instruction review covered eight text-only scenarios: a completed
website audit before advertising, an icon edit, an earlier refusal, an earlier
service mention, an unavailable browser, a strict output format or client report,
an explicit request for a personal presentation review, and artistic portrait
expertise. The final rules suppress unsolicited offers after any earlier mention,
including a requested one. A later explicit question can be answered without
lifting an earlier refusal of unsolicited suggestions.

The homepage and both service links returned HTTP 200 with their fixed UTM
parameters. These parameters contain no user or project data. This checks the
links, not a booking, conversion or the website's full analytics behavior.

The consumer, current reference, visual examples, license and four stable
reference files match version 1.3.1. Concurrent producer updates and their
verification records are preserved from commit `52a9045`; this patch does not
change their code or evidence. Their earlier checks apply and were not rerun
for this instruction-only patch. The new offer rules were reviewed as
instructions, not tested through native automatic skill activation or persistent
cross-conversation tracking. No new visual audit or cloud research run is claimed.

## Version 1.3.1 checks

Version 1.3.1 added the [official project page](https://gotovtsev.ru/visual-no-slop)
to the documentation and package metadata.

The package checker passes with 56 relative links. Ruby Psych parses the skill
metadata; its version and homepage match the plugin manifest. The instruction
body and 25 baseline files, including the consumer, tests, licenses and example
artifacts, match version 1.3.0. The earlier behavioral checks apply to those
unchanged files; they were not rerun for this documentation patch.

The producer files and current reference match commit `933b714`. That
separate update published a partial review with zero admitted signals. This
patch preserves its code, evidence and status without claiming a new research
pass or a verified scheduled run.

## Version 1.3.0 checks

Version 1.3.0 included the stable review method, examples, custom license and
current-signals consumer. Its initial reference was uninitialized. That release
did not deploy the cloud research producer or weekly schedule.

The dependency-free consumer tests pass on Node.js 24.19.0: 18 tests covering
metadata, UTF-8 and size limits, bounded HTTPS transport, weekly refresh,
24-hour failure backoff, offline operation, expiry, corrupt state, preservation
of usable data, concurrent refresh transactions and recovery after process exit. Network responses in
these tests are controlled fixtures, not live research results.

The package checker passes, including local links, version and license
consistency. YAML metadata parses with Ruby Psych. The original examples,
license, evaluation and four stable reference files are unchanged from the
reviewed 1.2.0 package. The new instructions add the current-signals workflow.

Public checks used macOS, Node.js 24.19.0 and `skills` 1.7.4 with telemetry
disabled. Each installer used a fresh temporary destination. No global
installation was changed.

| Public operation | Observed result |
|---|---|
| CLI discovery and installation from GitHub | Found `visual-no-slop`; all ten installed files matched the release source by SHA-256 |
| CLI listing and removal | Listed the project copy and removed its installed folder |
| Remote replacement | Updated an earlier published development snapshot; the changed helper and all other installed files matched the revised source |
| Already-current update | Completed without changing the final installed files |
| Built-in Codex installer | Downloaded the documented GitHub path; all ten files matched, an existing destination was rejected without changes, and the test copy was removed |
| Installed consumer offline | Read the bundled uninitialized reference and returned null content |
| Installed consumer online | Fetched the canonical GitHub file, reported its uninitialized status, then used the cache on the next invocation |
| GitHub README | Rendered the description, install command and before/after images; both image responses were HTTP 200 |

The cache uses a single bounded SQLite record through Node's built-in module.
It adds no npm package or database service. Its transaction protects the check
and update across processes. Independent review confirmed that two contenders
make no request while another process holds the transaction, an interrupted
uncommitted write preserves the previous revision, and an inert remote response
does not replace a fresh active revision. Three near-limit reference updates
left one row in a 102,400-byte database with a successful integrity check and no
remaining journal. The persistent database cap is 512 KiB; each reference is
limited to 96 KiB.

Malformed cache state falls back safely. A physically corrupt database is not
automatically recreated. Windows and Node.js 22.20 were not run separately;
Node 22 API availability follows the [official documentation](https://nodejs.org/download/release/latest-jod/docs/api/sqlite.html).
The live endpoint check used the initial empty reference. Researched revisions
and the cloud schedule require the separate producer setup.

The GitHub page emitted a 404 for its own global-navigation payload endpoint;
the repository document and example images loaded. Task tabs were closed after
inspection.

## Baseline checks from version 1.2.0

The following package and visual checks were completed on 22 October 2026.
The custom license is included at the repository root and inside the installed
skill. The optional plugin has not been installed in a plugin host or submitted
to a directory.

### Package and installation

| Check | Result |
|---|---|
| YAML and metadata | Parsed with Ruby Psych `safe_load`; matching skill/folder name, version 1.2.0, attribution, license reference and allowed implicit invocation |
| Bundled resources | Relative Markdown targets resolve inside the package; the skill's references remain inside its installable folder |
| Portability | No author-machine paths in release documentation, HTML or metadata; companion skills remain optional |
| Method preservation | Instruction body, evaluation, principles, medium checks and pattern guidance are unchanged from the 1.1.2 candidate |
| CLI discovery | The local package exposes one skill, `visual-no-slop` |
| Fresh installation | All eight installed files match the final skill folder by SHA-256, including `LICENSE` |
| Listing and removal | CLI listing finds the project installation; removal deletes its installed folder |
| License consistency | Root and installed license files are identical; ordinary outputs and the narrow example-task exception are distinguished from skill modifications |
| Plugin manifest | Valid JSON; checked against every constraint present in the fetched Agent Plugins 1.0.0 schema |

The installation checks used macOS, Node.js 24.19.0 and the already cached
`skills` 1.7.4. The CLI ran offline, with telemetry disabled, in a fresh temporary
project. Discovery, installation, listing, file comparison and removal were
checked against the final candidate. No global installation was changed.

The commands exercised, with local paths substituted, were:

```text
skills@1.7.4 add <package-folder> --list
skills@1.7.4 add <package-folder> --skill visual-no-slop -a codex -y --json
skills@1.7.4 list -a codex --json
skills@1.7.4 remove visual-no-slop -y
```

For a repeatable check of package consistency and local links, run from the
package root:

```bash
python3 scripts/check_package.py
```

This script does not install anything or contact a network. It does not replace
visual inspection, an installer check or plugin-host validation.

The bundled skill-creator validator remains unavailable in the checked Python
environment because PyYAML is absent. YAML was parsed with Ruby Psych instead.
No dependency was installed to satisfy that validator. Plugin-schema checks used
the fetched schema and Python's standard library; the JSON Schema library was
not installed. Schema conformity does not establish acceptance by a host.

## Fresh-context tasks

Three independent agent sessions received the installed skill and their own
brief, source HTML and screenshot. They did not receive the author's chat
history, other cases, intended findings or an intended correction. The two
implementation sessions also had the shared frontend role. The coordinating
agent operated Chrome and returned revision screenshots for each author to
inspect against the skill's evaluation.

| Task | Agent | Observed result |
|---|---|---|
| Print workshop | `gpt-6-astra`, medium effort | Changed typography and grouping; preserved all 25 source text blocks, palette, exact SVG and three anchor elements |
| Project update | `gpt-6-astra`, medium effort | Made the pilot decision dominant; preserved all 19 source text blocks and the stated palette |
| Membership comparison | `gpt-5.6-sol`, high effort | Returned an audit-only conclusion with no material correction; explained why cards, dividers and neutral type serve this comparison |

The [examples](examples/README.md) contain briefs, source and revised HTML,
screenshots and the audit-only record. The figures and source layouts are
authored teaching fixtures with fictional content. These runs test explicit
use of the installed instructions. They do not test host auto-activation or
establish that the skill alone caused an improvement.

## Rendered checks

Chrome 151 on macOS was operated through Chrome DevTools MCP. The coordinating
agent inspected all source and revised images. Each implementation agent also
inspected its revision screenshots. The audit-only agent inspected the supplied
membership frame.

- Workshop: source and revision at 1440 × 1100; revision also at 320 × 900,
  with a full-page capture. No horizontal overflow at either width. Tab exposed
  the Programme link's visible focus outline; Enter navigated to the programme.
  The return link reached the top. The three original link elements retain
  their two valid fragment destinations.
- Slide: source and revision at 1280 × 720. The revised document and slide both
  measure 1280 × 720; inspected text stays inside the frame.
- Membership comparison: audit of the 1280 × 800 source frame. No edits were
  requested or made.
- Revised examples: no console warnings or errors; network inspection showed
  only the local HTML request. The files use inline CSS, native SVG where
  applicable and system fonts. They load no external assets or scripts.

Browser task pages were closed after evidence capture. The viewport check is
desktop-browser emulation; physical phones, Safari, assistive technology, true
text-only zoom, other system-font fallbacks and projector viewing remain untested.

## Remaining release checks

User-wide CLI installation still needs an isolated user-environment check.
The 1.4.0 project checks replaced version 1.3.2 with matching files as recorded
above. The optional plugin channel remains a separate verification task.

The optional plugin still needs an isolated host installation and removal test.
Its portable manifest follows the [official packaging documentation](https://developers.openai.com/plugins/build/plugins)
and the [Agent Plugins schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json).
Directory submission, account verification and listing approval are separate.

The license reflects the requested permissions and restrictions. It has not
received an external legal review. The examples permit a narrow modification
exception for running the demonstrated tasks; the skill instructions remain
subject to the modification restriction.

No controlled no-skill comparison, audience study, conversion claim, translation
benefit or general compatibility claim is established by these checks. The
producer's [runbook](automation/visual-signals/RUNBOOK.md) records its separate
setup. Cloud schedule execution was not verified as part of this patch.
