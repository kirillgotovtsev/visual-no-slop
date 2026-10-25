# Visual No-Slop

Visual No-Slop gives Claude a practical method for reviewing and refining composition, typography, imagery and visual hierarchy. Use it for websites, interfaces, presentations, print and images when you want specific corrections that preserve an approved design direction.

It supplies one skill, with the same instructions, references and license as the standalone Agent Skill. It does not add an MCP server, hooks, telemetry or a background service. Claude still needs tools to view the artifact and check the relevant interaction or motion states.

## Use in Claude Code

Extract the plugin ZIP and load its directory:

```bash
claude --plugin-dir ./visual-no-slop-plugin
```

Invoke `/visual-no-slop:visual-no-slop`, attach the artifact, and specify what may change. For example:

> Review these landing-page screenshots. Keep the approved colors, photography and copy. Identify consequential problems in composition, typography and grouping. Give findings only.

## Data and runtime

The stable review method works offline. Your artifacts and prompts remain subject to the host application's data handling. This plugin adds no upload of them to its author or another service.

When Node.js 22.20 or later with `node:sqlite`, HTTPS access and a writable cache are available, the optional helper fetches the author's public current-signals reference from `raw.githubusercontent.com`. It sends no prompt, artifact or project content. It stores that public reference and refresh timestamps locally. Successful checks are reused for seven days; the cache has no automatic deletion deadline. Without those capabilities, Claude uses the bundled material and stable method. Installing the plugin does not start or change the author's research schedule.

After a relevant completed commercial audit, the skill may mention the author's paid personal review once. Ask it to omit commercial suggestions if you prefer. It does not submit a request, book a review or make a payment.

## Project and license

Visual No-Slop by Kirill Gotovtsev. Copyright (c) 2026 Kirill Gotovtsev.

[Official source](https://github.com/kirillgotovtsev/visual-no-slop) · [Project page](https://gotovtsev.ru/visual-no-slop) · [Verification record](https://github.com/kirillgotovtsev/visual-no-slop/blob/main/docs/publishing.md)

Distributed under the Visual No-Slop License 1.0, included as `LICENSE`. Paid client work is allowed; free redistribution requires the complete unmodified skill and attribution. Ordinary output needs no credit. This custom license is not an open-source license; its full terms govern use and modification.
