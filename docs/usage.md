# Using Visual no-slop

[Official project page](https://gotovtsev.ru/visual-no-slop) · [Installation](../README.md#install)

Give the agent the artifact, the relevant project context and a clear boundary for changes. It should use context already established in the conversation or project rather than ask you to supply the brief again.

A useful request identifies the intended audience or action, the medium and stage, what must stay, and whether you want findings or edits. Attach the source or export the agent can inspect. For an interface, provide access to the relevant screens and states.

## Invoke the skill

The task prompts below work across hosts. Select the skill using your host's controls, then send the prompt with the artifact.

| Host | Invocation |
|---|---|
| [Codex](https://learn.chatgpt.com/docs/build-skills) | Type `$visual-no-slop`, or find it through `/skills` in the CLI or IDE extension |
| [Claude Code](https://code.claude.com/docs/en/skills) | Type `/visual-no-slop` |
| [Cursor](https://cursor.com/docs/skills) | Type `/` in Agent chat and select `visual-no-slop` |
| [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) | Type `/` in chat and select `visual-no-slop` |
| [Claude web or desktop](https://support.claude.com/en/articles/12512180-use-skills-in-claude) | Enable the uploaded skill in **Customize > Skills**, then ask Claude to use `visual-no-slop` |

Hosts can also select skills from a matching description. Automatic selection and available tools depend on the host; the [compatibility record](compatibility.md) states what has been checked. The optional `agents/openai.yaml` provides Codex metadata and does not replace `SKILL.md` in other hosts.

## Review an existing artifact

Use this when you want to decide what to change before editing:

```text
Review the attached landing-page screenshots. Preserve the brand colors,
approved photography and copy. Identify the most consequential problems
in composition, typography and grouping. Give findings only.
```

The agent should examine composition and character before listing small defects. Each material finding should identify the location, visible property, consequence for the task, evidence or proposed check, and smallest useful correction. It should also preserve successful decisions and distinguish an aesthetic concern from a personal preference.

A screenshot can support a finding about visible hierarchy. Checking a menu, form or transition requires access to that behavior. The report should state which parts remain unverified.

## Make corrections

Use this when the agent may edit the source:

```text
Refine this page's typography and grouping. Preserve its content, routes
and accepted visual direction. Implement the corrections and inspect
the rendered desktop and mobile result.
```

The agent should inspect the original, keep a suitable before version, correct the identified causes and compare the changed area using the same content and scale. A small edit calls for a check of the affected element and related states. A full page review needs a view of the whole composition as well as sections and details.

The skill does not authorize publication or expand the agreed work. Existing approvals and holds still apply.

## Create new visual work

The same review applies during creation. Supply the material and constraints you already have:

```text
Create a one-page poster using the supplied copy and photographs. Follow
the established visual direction. Make the event name, date and booking
instruction easy to find. Preserve the supplied facts and inspect the
finished poster at its intended size before delivery.
```

The agent should develop the composition around the actual content and intended expression. Missing material needs an authorized placeholder or a solution that does not depend on it. Invented testimonials, metrics, awards and product properties cannot fill an empty area.

Adapt these prompts to your task and keep the same boundary for changes when switching hosts.

## Access and verification

The skill supplies a review method. Your agent environment supplies the viewing and editing tools.

| Work | Access needed |
|---|---|
| Images, print and slide exports | A viewer that shows the whole composition and details at useful sizes |
| Interactive interfaces | A browser and access to the relevant screens, states and interactions |
| Motion | Playback, plus representative frames for close inspection |
| Corrections | The source artifact, editing tools and permission to make the changes |

Source code, a prompt or a successful build does not replace viewing the result. A still frame cannot establish motion quality. If a required view or tool is unavailable, the agent should finish the independent work and name the exact verification limit.

A familiar visual device can be appropriate. Cards may express real groups; quiet typography may support a strong image. The agent should judge these choices in the composition and brief. It should neither invent defects to fill a review nor use a device's possible suitability to dismiss a visible problem. The [teaching examples](../examples/README.md) include an audit that retains justified cards.

The skill applies to visual creation, changes and review. Prose-only editing, nonvisual code, calculations, research without visual evaluation, deployment and skill configuration fall outside its scope. In a mixed task, it applies to the visual part.

The [capability matrix](compatibility.md#runtime-capabilities) explains the tools needed for each check. The stable review method works without Node.js, network access or a persistent cache. [VALIDATION.md](../VALIDATION.md) records completed checks.

## Manual installation

Use the complete `skills/visual-no-slop/` folder from the official repository or full release archive. The `visual-no-slop-1.4.0-skill.zip` archive contains that same folder under the name `visual-no-slop/`. Copy it into one of the locations below without editing or dropping bundled files.

| Host | Project location | User location |
|---|---|---|
| [Codex](https://learn.chatgpt.com/docs/build-skills) | `.agents/skills/visual-no-slop/` | `~/.agents/skills/visual-no-slop/` |
| [Claude Code](https://code.claude.com/docs/en/skills) | `.claude/skills/visual-no-slop/` | `~/.claude/skills/visual-no-slop/` |
| [Cursor](https://cursor.com/docs/skills) | `.cursor/skills/visual-no-slop/` | `~/.cursor/skills/visual-no-slop/` |
| [GitHub Copilot in VS Code](https://code.visualstudio.com/docs/agent-customization/agent-skills) | `.github/skills/visual-no-slop/` | `~/.copilot/skills/visual-no-slop/` |

Each destination must contain `SKILL.md` directly inside `visual-no-slop/`, with `eval.md`, `LICENSE`, `references/`, `scripts/` and the optional host metadata beside it. These are documented manual locations. The `skills` CLI may use a shared `.agents/skills/` copy and agent links instead.

Use project scope for work confined to that repository, or user scope for availability across projects on that machine. Choose one route and scope to avoid duplicate installations. A cloud session must receive the skill through that host's supported upload, repository or sync route; local installation alone does not establish cloud availability.

For Claude web or desktop, follow the [ZIP upload steps](../README.md#claude-web-or-desktop). No Node.js installation is required to upload the ZIP or use the stable instructions.

## Install from a local copy

For a full local repository copy or unpacked full archive, use the package folder containing `skills/visual-no-slop/SKILL.md` as the CLI source.

The local CLI checks used `skills` 1.7.4 with Node.js 24.19.0. From the project where you want to try the skill, replace `/absolute/path/to/visual-no-slop` below with your package path:

```bash
npx --yes skills@1.7.4 add /absolute/path/to/visual-no-slop --skill visual-no-slop -a codex -y
```

This uses project scope and selects Codex. Substitute `claude-code`, `cursor` or `github-copilot` for another target. Confirm the installation with the same agent value:

```bash
npx --yes skills@1.7.4 list -a codex --json
```

Check the [validation record](../VALIDATION.md) for the operations and environments tested. For GitHub installation, see the [README](../README.md#install).

## Update or remove

Use the same installer that placed the skill to update its instructions and scripts. The separate [current-signals reference](weekly-updates.md) has its own freshness checks; refreshing it does not update the skill or manage the cloud research producer.

For a global installation managed by the `skills` CLI:

```bash
npx --yes skills@latest update visual-no-slop --global
```

To remove the skill and its agent links from global scope:

```bash
npx --yes skills@latest remove visual-no-slop --global -y
```

For project scope, the corresponding commands are:

```bash
npx --yes skills@latest update visual-no-slop --project
npx --yes skills@latest remove visual-no-slop -y
```

These follow the [CLI command reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md). They apply to all installations of this skill managed by the CLI in the chosen scope. Check the affected agents before removing a shared copy. The earlier removal check used no agent filter: filtering removal to Codex reported success but left the shared folder in that test. Verify the resulting files and host list after removal.

For a copy installed by Codex's `$skill-installer`, ask Codex to locate that copy and update or remove it. The built-in installer refuses to overwrite an existing skill directory, so updating requires replacing the installed copy through an appropriate supported workflow. Keep project settings outside the skill and preserve its license and attribution when copying or moving it.

For a manual copy, replace the whole installed folder with the unchanged folder from a newer official release. Remove that folder to uninstall it. For a Claude ZIP upload, use Claude's skill management controls to replace the uploaded copy with the newer official ZIP, then confirm the intended copy is enabled. Remove or disable it there when no longer needed. Keep personal adjustments in your project instructions rather than modifying the protected skill.

When reporting a problem, include the skill version, host, request, observed behavior and expected behavior. Include the relevant artifact or screenshots only if you are entitled to share them.
