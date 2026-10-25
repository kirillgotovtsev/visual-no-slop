# Claude directory preparation

Prepared on 25 October 2026 for the author's requested replacement of the 1.4.0 release and submission to Anthropic's plugin directory. This document is not proof that Anthropic has accepted or published the plugin.

## Source and listing

- Repository: `https://github.com/kirillgotovtsev/visual-no-slop`
- Plugin path: repository root.
- Tracked branch: `main`.
- Plugin identifier: `visual-no-slop`; version: `1.4.0`.
- Author: Kirill Gotovtsev.
- Description: Review and refine composition, typography and imagery while preserving an approved visual direction.
- Homepage: [gotovtsev.ru/visual-no-slop](https://gotovtsev.ru/visual-no-slop).
- Manifest: [.claude-plugin/plugin.json](../.claude-plugin/plugin.json).
- Icon: an original 1254-pixel square PNG, generated for this project; bundled in the manifest directory and under 2 MiB.
- The repository README supplies the directory description; the plugin ZIP has a self-contained [README](plugin-README.md).
- License: the existing Visual No-Slop License 1.0, unchanged. It permits paid client use and free redistribution of the complete unmodified skill with attribution; it is not an open-source license.

There is one canonical skill directory. The plugin adds no MCP servers, hooks or background services. The skill's own supporting scripts are kept inside that directory.

## Data handling for the submission

These statements describe the code and instructions, not the host application's privacy terms:

- The skill asks Claude to inspect user-supplied artifacts. Such artifacts may contain personal data; do not claim the host never reads personal data.
- The optional current-signals helper makes an HTTPS GET to the public reference at `raw.githubusercontent.com/kirillgotovtsev/visual-no-slop/main/skills/visual-no-slop/references/current-signals.md`. It sends no artifact, prompt, project content or credentials. Normal network metadata, such as the connection IP, reaches GitHub.
- The helper stores the public reference and refresh timestamps in a local SQLite cache. A successful check is reused for seven days. Seven days is the refresh interval, not a deletion deadline. Cached data persists until removed or its environment is discarded; subsequent checks replace the stored reference.
- No analytics or telemetry is added by the plugin. The host's own processing, retention and integrations remain subject to its settings and terms.
- A conditional, disclosed link to the author's paid review service can be shown after a relevant audit. The plugin does not send a booking, contact details, payment or project files to that service. A user may ask to omit commercial suggestions.

The portal also asks about an intended under-18 audience and a reachable contact email. Use the author's account details and confirmed intent; do not infer either from the skill's content. Read the actual acknowledgements before submitting them.

## Verification and remaining steps

The [publishing record](publishing.md#initial-packaging-verification--25-october-2026) records the original path-only fix. The expanded package was checked again on 25 October 2026:

- All 11 archive tests pass, including repeated byte-identical builds, exact skill bytes, manifest placement/content and the catalogue README/icon.
- `check_package.py` passes and checks 84 relative references.
- Claude Code 2.1.310 on Linux x86_64 validates both the repository and an extracted plugin ZIP with `--strict --json`: no manifest errors/warnings and no directory findings. Its advisory about adding a marketplace install command is not a failed check; no Anthropic marketplace name is claimed before acceptance.
- A fresh local test marketplace and isolated `CLAUDE_CONFIG_DIR` pass install, enabled listing, SHA-256 comparison of all 15 installed plugin files, uninstall and marketplace removal. Temporary settings and caches are removed.
- The skill ZIP matches the original release byte-for-byte; its SHA-256 remains `fdd1511e871919527fe05ed35c7666d098facabcb5d434ae94ac3c489019089e`.

The directory portal's own validation, name availability check and security scan are still separate steps.

The portal at [claude.ai/directory/manage](https://claude.ai/directory/manage) currently requires sign-in in the working browser. No submission, compliance acknowledgement, authenticated model invocation or Claude web/desktop plugin upload has been completed in this task. Do not describe the plugin as listed or approved until the portal confirms that status.

The author has authorized release replacement. Preserve the original four assets, release text and tag target first; upload the corrected full/plugin archives and matching checksums, and retain the byte-identical skill ZIP. Record the exact build commit, replacement date and any tag move in the release notes. If the tag stays on the original commit, say so explicitly so the replacement artifacts are not confused with GitHub's automatic source archives.

Primary references: [submission](https://claude.com/docs/plugins/submit), [pre-submission checks](https://claude.com/docs/plugins/pre-submission-checklist), [manifest contract](https://code.claude.com/docs/en/plugins-reference).
