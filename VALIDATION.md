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

Public download, remote helper retrieval and installer checks are in progress.
Their results will be recorded here before the release is tagged. No global
installation is changed by the project-scoped checks.

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
A first-release update check cannot establish replacement by a later release.
The 20 October built-in installer helper checks covered URL parsing, validation
and local copying; they did not establish the network route.

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
