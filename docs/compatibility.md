# Compatibility and runtime requirements

[Official project page](https://gotovtsev.ru/visual-no-slop) · [Installation](../README.md#install) · [Usage](usage.md)

Visual no-slop 1.4.0 uses one Agent Skills folder across the installation routes below. The verification record covers installer checks and use confirmed by the author.

## Format and sources

The canonical folder is `skills/visual-no-slop/` in this repository:

```text
visual-no-slop/
├── SKILL.md
├── eval.md
├── LICENSE
├── references/
├── scripts/
└── agents/openai.yaml
```

The [Agent Skills specification](https://agentskills.io/specification) defines the required `SKILL.md`, YAML metadata and supporting files. The same folder is copied by the CLI, used for manual installation, and placed at the root of `visual-no-slop-1.4.0-skill.zip`. The full and plugin archives contain the same skill. No host-specific version of the review method is maintained.

The description stays within 200 characters to meet [Claude's documented upload limit](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills), which is stricter than the standard's 1,024-character maximum. The optional `agents/openai.yaml` supplies Codex metadata; the review method and resource paths remain in the shared files.

The following primary documentation was checked on 23 October 2026:

| Source | Basis for the instructions |
|---|---|
| [Codex skills](https://learn.chatgpt.com/docs/build-skills) | Local skill folders, `$` invocation, optional metadata and built-in installer |
| [Claude Code skills](https://code.claude.com/docs/en/skills) | Personal and project folders, supporting files and `/` invocation |
| [Cursor skills](https://cursor.com/docs/skills) | Skill directories, discovery and selection in Agent chat |
| [VS Code Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) | Copilot skill locations and slash commands |
| [Claude custom-skill packaging](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills) and [upload guide](https://support.claude.com/en/articles/12512180-use-skills-in-claude) | ZIP layout, description limit, upload and enablement |
| [Claude API runtime constraints](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview#runtime-environment-constraints) | No direct network access in the API skill sandbox |
| [`skills` agent list](https://github.com/vercel-labs/skills/blob/main/docs/agents.md) and [command reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md) | CLI target names, placement, scope, updates and removal |

These sources document host features. They do not certify this package or establish the result of a native invocation.

## Verification evidence

The table separates the documented route from the operations checked for this release. Detailed commands and historical evidence are in [VALIDATION.md](../VALIDATION.md).

| Target | Documented format or route | CLI placement or archive check for 1.4.0 | Native host behavior | Reference refresh in that host |
|---|---|---|---|---|
| Codex | Agent Skills folder; `$visual-no-slop` | Passed project install, listing, 1.3.2 replacement, hash comparison and removal | Earlier explicit-use visual tasks are recorded for 1.2.0; no new native invocation or automatic activation check for 1.4.0 | Earlier standalone helper checks apply to unchanged code; native invocation not checked |
| Claude Code | Agent Skills folder; `/visual-no-slop` | Passed install, listing, targeted replacement, hashes and removal; generic update left an old copy | Use confirmed by the author | Not run |
| Cursor | Agent Skills folder; select `/visual-no-slop` | Passed project install, listing, 1.3.2 replacement, hash comparison and removal | Use confirmed by the author | Not run |
| GitHub Copilot / VS Code | Agent Skills folder; select `/visual-no-slop` | Passed project install, listing, 1.3.2 replacement, hash comparison and removal | Use confirmed by the author | Not run |
| Claude web or desktop | ZIP with one skill folder; upload and enable | Passed ZIP layout, eleven file hashes and extracted helper checks | ZIP import confirmed by the author | Not run; depends on the available runtime and account settings |

On 23 October 2026, Kirill Gotovtsev confirmed use of version 1.4.0 in Claude Code, Cursor and GitHub Copilot, and import of the skill ZIP into Claude. This confirmation supplements the automated checks recorded below.

The checks used `skills` 1.7.4 and Node.js 24.19.0 on macOS in isolated project directories. All eleven installed files matched the candidate source by SHA-256. Codex, Cursor and Copilot used `.agents/skills/visual-no-slop/`; Claude Code used `.claude/skills/visual-no-slop/`. These noninteractive installations created copies. Every fresh copy ran the helper offline, and removal left no skill folders or links. User-wide installation has no separate isolated check in this release.

The generic CLI update correctly replaced the Codex, Cursor and Copilot copies from version 1.3.2. For Claude Code, it reported success but retained the old `.claude` copy and placed new files in `.agents`. Repeating the explicit `add -a claude-code` command replaced the actual Claude copy with matching files. Use the [verified replacement instructions](usage.md#update-or-remove).

The standalone helper extracted from the skill ZIP fetched the current reference and used its cache on the next invocation. This checks the supplied Node runtime and network path; it does not establish execution inside another AI application.

The package checker and nine archive-builder tests passed against the prepared files. Those checks cover local references, archive layouts, identical skill contents, reproducibility and path safety. They do not exercise a host's upload or invocation controls.

The earlier teaching tasks used the installed instructions explicitly. Automatic activation, comparisons of outcomes across hosts and a controlled comparison with a no-skill baseline require separate evidence.

## Runtime capabilities

| Capability | What the host must provide | If unavailable |
|---|---|---|
| Read the stable method | Access to `SKILL.md`, `eval.md` and the relevant bundled references | The host has not loaded the complete method |
| Review an image, slide, print layout or rendered frame | An actual image or document viewer at useful sizes | Complete independent work and identify the unviewed artifact; source text alone cannot pass visual review |
| Inspect an interface | A browser with access to the relevant screens and interactions | Limit findings to the states that can be viewed |
| Inspect motion | Playback and representative frames | State that motion remains unverified |
| Make corrections | Source access, editing tools and authorization | Return findings within the requested scope |
| Refresh current signals | Command execution, Node.js 22.20+ with `node:sqlite`, permitted HTTPS and a writable cache | Use a still-current bundled reference when available, then the stable method and historical patterns |
| Retain the seven-day check interval | A cache that survives between tasks | No cross-session refresh cadence is established |

The skill supplies no browser, image editor, playback tool or background scheduler. A host can satisfy the file-format contract while lacking a capability needed for the task. It should report that exact limit and continue the work it can verify.

The stable method needs no network or Node.js runtime. A bundled current-signals file is usable only while its status, source, schema and dates satisfy the [reference contract](weekly-updates.md). An expired file cannot support a claim about current signals.

Cloud environments need separate checks for command execution, runtime version, network permissions and storage lifetime. Claude's API skill sandbox has no direct network access, so the online helper cannot refresh there. A host's web-search tool does not substitute for the helper's validation or persistent cache. The fallback does not require installing tools or changing the host's permissions.

The optional plugin archive has separate host and directory requirements. Its manifest and archive structure do not establish a native plugin installation; see the [plugin checklist](publishing.md#optional-plugin-channel).
