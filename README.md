# Visual no-slop

Give your AI agent a practical way to find generic layouts, weak typography and confusing hierarchy, then make specific corrections while preserving the design you've approved.

[Official project page](https://gotovtsev.ru/visual-no-slop)

Visual no-slop is an [Agent Skill](https://agentskills.io/specification) for creating and reviewing websites, interfaces, images, slides, print and other visual work. It asks the agent to inspect the actual result, explain what needs attention and check the corrections before delivery.

Use it when you want to:

- Turn “this looks generic” into findings about composition, type, imagery and grouping.
- Refine an existing design while keeping its approved direction, content and working flows.
- Review a poster, deck or image at the size people will see it.
- Check a new design as it develops, including the relevant interface or motion states.

Version **1.4.0** packages the same review method for Codex, Claude Code, Cursor, GitHub Copilot in VS Code, and Claude's ZIP upload. Each route uses one unchanged `visual-no-slop` skill folder. The [compatibility record](docs/compatibility.md) separates documented support, installer checks and native host behavior.

## Install

Choose one installation method for each environment.

### Terminal

The [`skills` CLI](https://github.com/vercel-labs/skills) requires Node.js 22.20 or later, npm and Git. To choose your agents and installation scope interactively, run:

```bash
npx --yes skills@latest add kirillgotovtsev/visual-no-slop --skill visual-no-slop
```

For a direct installation, replace `<agent>` with a value from the table:

```bash
npx --yes skills@latest add kirillgotovtsev/visual-no-slop --skill visual-no-slop -a <agent> -g -y
```

| Agent | Value for `<agent>` |
|---|---|
| Codex | `codex` |
| Claude Code | `claude-code` |
| Cursor | `cursor` |
| GitHub Copilot / VS Code | `github-copilot` |

`-g` installs for your user; omit it for the current project. `-y` accepts the CLI's installation choices; omit it to review them. The [CLI's agent list](https://github.com/vercel-labs/skills/blob/main/docs/agents.md) documents its destinations. Placing the files does not verify that a host loads or uses them.

### Claude web or desktop

Download `visual-no-slop-1.4.0-skill.zip` from the [official releases](https://github.com/kirillgotovtsev/visual-no-slop/releases). In Claude, open **Customize > Skills**, choose **+ > Create skill > Upload a skill**, upload the ZIP and enable it. Code execution must be enabled, and organization settings may control access. These steps follow [Claude's upload guide](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

Use the archive ending in `-skill.zip`: it contains one `visual-no-slop/` folder with `SKILL.md` directly inside it. The full repository and plugin archives serve other purposes.

### Manual copy

Copy the complete `skills/visual-no-slop/` folder from an official release, or extract the skill ZIP, into your host's skill directory. Keep the folder unchanged, including its references, scripts and license. The [usage guide](docs/usage.md#manual-installation) lists project and user locations; this route needs no terminal installer.

### Ask Codex to install it

Paste this into a local Codex conversation:

```text
Use $skill-installer to install visual-no-slop from:

https://github.com/kirillgotovtsev/visual-no-slop/tree/main/skills/visual-no-slop

Install it for my user so it is available across projects.
```

This optional route is specific to Codex. Use the skill on your next turn; if it does not appear, restart Codex. The built-in installer handles placement independently of the `skills` CLI. See the [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills).

## Give it a task

Invoke `$visual-no-slop` in Codex, select `/visual-no-slop` in Claude Code, Cursor or Copilot chat, or enable the uploaded skill in Claude. Then provide the artifact and say what the agent may change:

```text
Review the attached landing-page screenshots. Preserve the brand colors,
approved photography and copy. Identify the most consequential problems
in composition, typography and grouping. Give findings only.
```

The [usage guide](docs/usage.md) covers invocation, corrections, new work, updates and removal. The skill needs no server or companion skill. Your host must provide the tools to view the artifact and inspect any relevant interactions or motion.

## See the method

| Workshop source | Agent revision |
|---|---|
| [![Source workshop layout](examples/print-workshop/before.png)](examples/print-workshop/before.png) | [![Revised workshop layout](examples/print-workshop/after.png)](examples/print-workshop/after.png) |

The [examples](examples/README.md) include before-and-after versions of a print-workshop design and a project update, plus an audit that keeps justified cards. These are authored teaching fixtures with agent revisions. They illustrate review decisions and do not measure the skill's effect against a no-skill baseline.

The review starts with composition and visual character, then checks legibility, functionality and relevant states. A material finding connects a visible property to its consequence:

> Location → observation → consequence for the task → evidence or verification method → minimal correction.

The agent distinguishes defects, reasoned aesthetic concerns, preferences, justified devices and unresolved questions. A review may find no problems. Popular fonts, gradients or cards do not establish a defect on their own, and appearance cannot establish AI authorship. The [research basis](skills/visual-no-slop/references/basis.md) explains the sources and limits.

## Current visual signals

The optional reference helper needs Node.js 22.20 or later with `node:sqlite`, command execution, permitted HTTPS access and a writable cache. A persistent cache lets it reuse a successful check for seven days. It runs when the skill is used and creates no background service. Instruction updates still use your installer.

The stable review method works offline. A bundled reference is usable only until its stated expiry; cloud and API environments may lack the runtime, network access or persistent storage needed for refreshes. The [weekly-update guide](docs/weekly-updates.md) explains these limits. The first published research review admitted no signals and records partial source coverage. Producer operation and schedule evidence live in its [runbook](automation/visual-signals/RUNBOOK.md) and run records; installing this skill does not start the producer.

See [VALIDATION.md](VALIDATION.md) for completed checks and remaining verification, and [CHANGELOG.md](CHANGELOG.md) for version history.

## Personal review by the author

Kirill Gotovtsev offers paid marketing reviews of websites, commercial proposals and presentations through [Meatlook](https://meatlook.ru/?utm_source=visual_no_slop&utm_medium=readme&utm_campaign=human_review), with a personal discussion and written conclusions. See the service pages for scope and current terms.

After a completed audit relevant to an advertising launch, contractor acceptance or client presentation, the skill may mention this option once in the available conversation. You can ask it to omit commercial suggestions. The offer stays outside your deliverables and does not affect the completeness of the review. The [personal-review guidance](skills/visual-no-slop/references/human-review.md) defines the conditions.

## License

Visual No-Slop by Kirill Gotovtsev is free to use under the custom [Visual No-Slop License 1.0](LICENSE). It is not open source.

You may use it for paid client work and share the complete, unmodified skill for free with its attribution, version, license and source reference. Ordinary outputs, such as websites, designs and presentations, need no author credit under this license.

Selling the skill, charging for access, modifying its protected materials or making derivative skills from them requires separate written permission, subject to the exceptions in the license. Keep project-specific settings outside the skill and install official updates. The full license governs these permissions.

For release preparation, use the [publishing checklist](docs/publishing.md).
