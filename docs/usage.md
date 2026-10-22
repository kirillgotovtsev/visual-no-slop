# Using Visual no-slop

Give the agent the artifact, the relevant project context and a clear boundary for changes. It should use context already established in the conversation or project rather than ask you to supply the brief again.

A useful request identifies the intended audience or action, the medium and stage, what must stay, and whether you want findings or edits. Attach the source or export the agent can inspect. For an interface, provide access to the relevant screens and states.

## Review an existing artifact

Use this when you want to decide what to change before editing:

```text
$visual-no-slop

Review the attached landing-page screenshots. Preserve the brand colors,
approved photography and copy. Identify the most consequential problems
in composition, typography and grouping. Give findings only.
```

The agent should examine composition and character before listing small defects. Each material finding should identify the location, visible property, consequence for the task, evidence or proposed check, and smallest useful correction. It should also preserve successful decisions and distinguish an aesthetic concern from a personal preference.

A screenshot can support a finding about visible hierarchy. Checking a menu, form or transition requires access to that behavior. The report should state which parts remain unverified.

## Make corrections

Use this when the agent may edit the source:

```text
$visual-no-slop

Refine this page's typography and grouping. Preserve its content, routes
and accepted visual direction. Implement the corrections and inspect
the rendered desktop and mobile result.
```

The agent should inspect the original, keep a suitable before version, correct the identified causes and compare the changed area using the same content and scale. A small edit calls for a check of the affected element and related states. A full page review needs a view of the whole composition as well as sections and details.

The skill does not authorize publication or expand the agreed work. Existing approvals and holds still apply.

## Create new visual work

The same review applies during creation. Supply the material and constraints you already have:

```text
$visual-no-slop

Create a one-page poster using the supplied copy and photographs. Follow
the established visual direction. Make the event name, date and booking
instruction easy to find. Preserve the supplied facts and inspect the
finished poster at its intended size before delivery.
```

The agent should develop the composition around the actual content and intended expression. Missing material needs an authorized placeholder or a solution that does not depend on it. Invented testimonials, metrics, awards and product properties cannot fill an empty area.

Prompts in this guide are examples you may adapt for your tasks. Explicit `$visual-no-slop` invocation is useful when you want the skill applied. Its Codex metadata also allows the host to select it for a matching visual task.

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

Compatibility with another Agent Skills host depends on that host's discovery rules and visual tools. [VALIDATION.md](../VALIDATION.md) records the environments and operations actually checked.

## Install from a local copy

If you have a local copy or unpacked archive, use its package folder as the source. The folder must contain `skills/visual-no-slop/SKILL.md`.

The local CLI checks used `skills` 1.7.4 with Node.js 24.19.0. From the project where you want to try the skill, replace `/absolute/path/to/visual-no-slop` below with your package path:

```bash
npx --yes skills@1.7.4 add /absolute/path/to/visual-no-slop --skill visual-no-slop -a codex -y
```

This uses project scope. Confirm the installation with:

```bash
npx --yes skills@1.7.4 list -a codex --json
```

Check the [validation record](../VALIDATION.md) for the operations and environments tested. For GitHub installation, see the [README](../README.md#install).

## Update or remove

Use the same installer that placed the skill to update its instructions and scripts. The separate [current-signals reference](weekly-updates.md) checks for fresh data on first use after seven days when Node.js and network access are available. The initial reference is uninitialized; the cloud research producer is configured separately.

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

These follow the [CLI command reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md). The removal check used the command without an agent filter: filtering removal to Codex reported success but left the shared skill folder in that test.

For a copy installed by Codex's `$skill-installer`, ask Codex to locate that copy and update or remove it. The built-in installer refuses to overwrite an existing skill directory, so updating requires replacing the installed copy through an appropriate supported workflow. Keep project settings outside the skill and preserve its license and attribution when copying or moving it.

When reporting a problem, include the skill version, host, request, observed behavior and expected behavior. Include the relevant artifact or screenshots only if you are entitled to share them.
