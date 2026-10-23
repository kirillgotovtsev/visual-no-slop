# Compatibility and runtime requirements

[Official project page](https://gotovtsev.ru/visual-no-slop) · [Installation](../README.md#install) · [Usage](usage.md)

Visual no-slop 1.4.0 uses one Agent Skills folder across the installation routes below. Installation checks establish file placement. Native discovery, invocation and visual inspection require their own evidence from the host.

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
| Codex | Agent Skills folder; `$visual-no-slop` | Pending project install, listing, hash comparison and removal | Earlier explicit-use visual tasks are recorded for 1.2.0; no new native invocation or automatic activation check for 1.4.0 | Earlier standalone helper checks apply to unchanged code; native invocation not checked |
| Claude Code | Agent Skills folder; `/visual-no-slop` | Pending project install, listing, hash comparison and removal | Not run | Not run |
| Cursor | Agent Skills folder; select `/visual-no-slop` | Pending project install, listing, hash comparison and removal | Not run | Not run |
| GitHub Copilot / VS Code | Agent Skills folder; select `/visual-no-slop` | Pending project install, listing, hash comparison and removal | Not run | Not run |
| Claude web or desktop | ZIP with one skill folder; upload and enable | Builder tests passed for layout and identical skill files; final release archive readback pending | ZIP import, activation and removal not run | Not run; depends on the available runtime and account settings |

The planned CLI checks use `skills` 1.7.4 in isolated project directories. They cover the `codex`, `claude-code`, `cursor` and `github-copilot` destinations without launching those hosts. The CLI can copy files or create links; record the observed path and mode rather than assuming a shared copy. Installed hashes and removal results must be recorded before the table is marked passed. User-wide installation has no separate isolated check in this release.

The package checker and nine archive-builder tests passed against the prepared files. Those checks cover local references, archive layouts, identical skill contents, reproducibility and path safety. They do not exercise a host's upload or invocation controls.

Only the Codex executable is available in the test environment. `claude`, `cursor`, `cursor-agent`, `copilot` and `code` are absent; no native GUI check is claimed. The earlier teaching tasks used the installed instructions explicitly. They do not establish automatic activation, equivalent results in another host or a controlled improvement over a no-skill baseline.

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
