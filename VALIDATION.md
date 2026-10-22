# Validation

Release **1.3.0**, prepared on 23 October 2026. The public package includes
the stable review method, examples, custom license and current-signals consumer.
The initial reference is uninitialized. The cloud research producer and weekly
schedule have not been deployed by this release.

## Version 1.3.0 checks

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
The public update check replaced a development snapshot of this first release;
a migration between separately tagged versions has not yet occurred. The
optional plugin channel remains a separate verification task.

The optional plugin still needs an isolated host installation and removal test.
Its portable manifest follows the [official packaging documentation](https://developers.openai.com/plugins/build/plugins)
and the [Agent Plugins schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json).
Directory submission, account verification and listing approval are separate.

The license reflects the requested permissions and restrictions. It has not
received an external legal review. The examples permit a narrow modification
exception for running the demonstrated tasks; the skill instructions remain
subject to the modification restriction.

No controlled no-skill comparison, audience study, conversion claim, translation
benefit or general compatibility claim is established by these checks. Weekly
research and the cloud schedule remain separate setup work. The consumer is
included; its first reference contains no researched findings.
