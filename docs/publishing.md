# Publishing Visual no-slop

Use this checklist for releases of `kirillgotovtsev/visual-no-slop`. Version **1.4.0** adds cross-agent installation guidance and a skill ZIP alongside the full and plugin archives. [VALIDATION.md](../VALIDATION.md) and the [compatibility record](compatibility.md) record automated checks, the author's confirmation of native use and remaining verification tasks.

The official project page is [gotovtsev.ru/visual-no-slop](https://gotovtsev.ru/visual-no-slop). Use this address in the GitHub Website field, the README, release notes, and the skill and plugin homepage metadata. Keep the GitHub repository as the source and installation address.

Keep one canonical skill at `skills/visual-no-slop/`. All installation routes distribute that folder unchanged. Host instructions belong in the documentation; do not maintain separate copies of the review method for different agents.

## Prepare the release files

- Check that the README, `SKILL.md` metadata, changelog and `.claude-plugin/plugin.json` identify the same version.
- Include the final `LICENSE` at the repository root and inside `skills/visual-no-slop/`, so an installation of that folder retains the terms and attribution.
- Verify all relative links and bundled reference paths from the files that use them. Remove author-machine paths, temporary files and private material from the release package.
- Keep the examples' provenance with their images. Describe them as authored teaching fixtures with agent revisions; preserve the audit-only counterexample that retains justified cards.
- Check that the license summary matches the full terms: paid client work is allowed, free redistribution requires an unmodified copy and attribution, and ordinary outputs need no author credit. Do not describe this custom restrictive license as open source.
- Update `VALIDATION.md` and the compatibility matrix with the actual commands, environment, results and limits. Distinguish format checks, CLI file placement, native activation, reference refresh and visual outcome evidence.
- Review the final public prose. Inspect changed visual examples; reuse earlier image checks when the files and relevant conditions are unchanged. Record any part that remains unverified.

Keep the skill description within 200 characters for the documented Claude upload limit, as well as the Agent Skills standard's 1,024-character maximum. Check the [current primary sources](compatibility.md#format-and-sources) before changing these bounds. The optional `agents/openai.yaml` may remain in the same folder.

For changes to the current-signals consumer, also run `node --test scripts/test_current_signals.mjs`. Keep the [producer contract](weekly-updates.md#file-contract-for-the-producer) compatible with the installed consumer. Weekly reference updates do not change the stable package version.

## Verify the local package

Run `python3 scripts/check_package.py` from the package root for version, attribution, license, example and local-link consistency. The current local installation and visual checks are recorded in [VALIDATION.md](../VALIDATION.md).

Use a fresh temporary project to avoid replacing an existing installation. Run discovery, installation, listing and removal for `codex`, `claude-code`, `cursor` and `github-copilot`, then compare every installed file with the canonical folder, including the license. Record the CLI version, runtime, destinations, links and scope. Check user scope separately in an isolated user environment. These tests verify placement and removal; they cannot establish native behavior when the host itself is absent.

Where a native host is available, verify discovery and explicit invocation, access to bundled references, and a representative visual task without the author's chat history. Include a task where a commonly criticized device is justified. Record the request, inputs, host version, model, resulting artifact and verification limits. Test automatic activation separately before claiming it works.

For the Claude ZIP route, check the archive structure locally, then record actual upload, enablement, invocation and removal in Claude when that environment is available. An archive that follows the documented format is still an unverified import until those operations succeed. For reference refreshing, test the helper in the host's actual runtime with permitted network access and a retained cache; record offline and unavailable-runtime behavior separately.

The included teaching fixtures explain the method. They do not establish a measured improvement against a no-skill baseline. A controlled comparison would require its own design and evidence.

## Build the release archives

From the package root, run:

```bash
python3 scripts/build_release.py --output <directory>
```

Replace `<directory>` with the release output directory. This builds distribution files; users install through their host or the existing `skills` CLI.

| Archive | Contents and purpose |
|---|---|
| `visual-no-slop-1.4.0.zip` | Tracked repository files under `visual-no-slop-1.4.0/`, including documentation, examples, validation and producer records |
| `visual-no-slop-1.4.0-plugin.zip` | Claude plugin with `.claude-plugin/plugin.json`, `.claude-plugin/icon.png`, root `README.md`, `LICENSE` and `skills/visual-no-slop/` |
| `visual-no-slop-1.4.0-skill.zip` | One `visual-no-slop/` folder for Claude upload or manual installation |

The skill archive must contain `visual-no-slop/SKILL.md`, with `eval.md`, `LICENSE`, `references/`, `scripts/` and `agents/openai.yaml` inside that same folder. It must have no extra repository wrapper or plugin manifest. Compare every extracted skill file against `skills/visual-no-slop/`; all three archives must carry the same canonical skill and license. The builder writes `SHA256SUMS` beside the archives, with each SHA-256 hash followed by two spaces and its archive filename. Verify clean extraction, relative paths and checksums before attaching the archives to a release.

The plugin ZIP originally published with **1.4.0 on 23 October 2026** had `plugin.json` at its root. On **25 October 2026**, the author authorized replacing that release with corrected packaging and preparing an Anthropic directory submission. Before replacement, preserve the original assets, release description and tag target. Build in a fresh directory, replace the full and plugin ZIPs and checksums together, and record the exact build commit in the release description. The standalone skill ZIP must remain byte-identical. This is a packaging correction at the author's request, not a new methodology version; future changes should use a new version so existing plugin installs receive updates.

## Publish the GitHub skill

For an authorized release:

1. Put this package at the repository root so `skills/visual-no-slop/SKILL.md` resolves at the documented path on `main`. Preserve concurrent changes, including the producer's reference and run records.
2. Set the repository website, description and topics. Keep the custom license file; do not substitute a standard open-source license from a repository template.
3. Push the candidate files and check the public README, relative links, images, license and skill path in GitHub.
4. Test the documented GitHub install for each CLI target in a fresh project. Confirm discovery, installed-file hashes and CLI listing. Record native host discovery and representative invocation separately, including whether the bundled references are available.
5. Check the documented update and removal commands against the actual installed agent path. A first-release “already current” result does not test replacement by a later version. The checked `skills` 1.7.4 Claude Code copy needs the [targeted replacement command](usage.md#update-or-remove); its generic update reported success while retaining an older agent copy. Test user-wide installation separately in an isolated user environment before claiming it works.
6. For Codex's optional `$skill-installer` route, retain the earlier network-install evidence and repeat the check when a change affects that route. Its result does not establish CLI or other-host compatibility.
7. Record the remote results and remaining limits in `VALIDATION.md`. Keep the README's feature and compatibility claims within those results.
8. Tag the reviewed release, create the GitHub release and attach all three archives and their SHA-256 checksums. Confirm that each archive contains the version, license, attribution and source reference, and that its files match the tagged package. Exclude Git metadata, caches, credentials and local task records.

The project-scoped CLI smoke check starts with:

```bash
npx --yes skills@1.7.4 add kirillgotovtsev/visual-no-slop --skill visual-no-slop -a codex -y
npx --yes skills@1.7.4 list -a codex --json
npx --yes skills@1.7.4 update visual-no-slop --project
npx --yes skills@1.7.4 remove visual-no-slop -y
```

For the Claude Code copy case, replace the `update` line with the same targeted `add` command used for installation. Confirm the new version and file hashes in `.claude/skills/visual-no-slop/` before removal.

Repeat with `claude-code`, `cursor` and `github-copilot` in fresh destinations. Use the global, Claude ZIP and Codex installer instructions in the [README](../README.md#install) for their separate checks. Record a skills.sh listing only after inspecting its public page and install target; keep it out of release claims until then.

### Repository description

```text
An Agent Skill for reviewing and refining composition, typography and imagery while preserving an approved visual direction.
```

### Repository topics

```text
agent-skills, codex, claude-code, cursor, github-copilot, ai-agents, visual-design, design-review, typography, ui-design, presentations, print-design
```

## Optional plugin channel

The single source manifest now lives at [.claude-plugin/plugin.json](../.claude-plugin/plugin.json) in the repository, so the directory can read the source directly. The builder includes that file unchanged, bundles the icon, and maps [the standalone plugin README](plugin-README.md) to `README.md` inside the plugin ZIP. `LICENSE` and `skills/visual-no-slop/` stay at the plugin root. The full archive preserves repository paths; the skill ZIP contains no plugin manifest or catalogue assets.

This matches Anthropic's [plugin layout](https://github.com/anthropics/claude-plugins-official/blob/main/README.md), [Claude Code manifest contract](https://code.claude.com/docs/en/plugins-reference) and [Claude Plugins API manifest location](https://platform.claude.com/docs/en/manage-claude/plugins-api). The existing name, version, description, author object, URLs, license string and keyword array pass Claude Code's manifest validator. Its `$schema` is a portable editor hint, not an Anthropic schema URL; Claude Code ignores that field at load time. No manifest field or license change was needed.

### Initial packaging verification — 25 October 2026

- The new manifest regression test failed on the old builder because `.claude-plugin/plugin.json` was absent, then passed after the path correction. All ten release tests pass, including byte-for-byte reproducibility, exact skill contents, checksums and overwrite protection.
- An extracted candidate passed `claude plugin validate <plugin-directory> --strict --json` using Claude Code **2.1.310** on Linux x86_64: exit 0, `success: true`, and no manifest errors or warnings. The separate directory-submission findings report a missing README and icon; this is not a directory-ready submission.
- With a fresh `CLAUDE_CONFIG_DIR` and temporary project, a local test marketplace was added; the plugin installed in user scope and appeared enabled at version 1.4.0. All thirteen cached plugin files matched the extraction by SHA-256.
- Uninstall succeeded and `claude plugin list --json` returned `[]`. Removing the test marketplace left empty plugin, marketplace and enablement registries. Claude retained an orphan-marked cache until the temporary test directory was removed.
- No authenticated model invocation, automatic skill activation, visual task, Claude web/desktop plugin upload or Enterprise Plugins API upload was tested. Earlier author-confirmed use of the standalone skill is separate evidence. Cursor's plugin format and public marketplace acceptance remain unverified.

To repeat the archive tests, run `python3 scripts/check_package.py` and `python3 scripts/test_release_package.py`. To repeat the host check with Claude Code installed, build into a fresh output directory and run the following from the repository root. The subshell confines configuration changes to the temporary directory; it does not submit anything to a public marketplace:

```bash
(
  set -eu
  plugin_test_dir="$(mktemp -d)"
  trap 'rm -rf -- "$plugin_test_dir"' EXIT
  export CLAUDE_CONFIG_DIR="$plugin_test_dir/config"
  python3 scripts/build_release.py --output "$plugin_test_dir/release"
  python3 - "$plugin_test_dir" <<'PY'
import json
from pathlib import Path
import sys
import zipfile

root = Path(sys.argv[1])
marketplace = root / "marketplace"
manifest_dir = marketplace / ".claude-plugin"
manifest_dir.mkdir(parents=True)
version = json.loads(Path(".claude-plugin/plugin.json").read_text())["version"]
with zipfile.ZipFile(root / "release" / f"visual-no-slop-{version}-plugin.zip") as archive:
    archive.extractall(marketplace / "plugins" / "visual-no-slop")
(manifest_dir / "marketplace.json").write_text(json.dumps({
    "name": "visual-no-slop-packaging-test",
    "owner": {"name": "Kirill Gotovtsev"},
    "plugins": [{"name": "visual-no-slop", "source": "./plugins/visual-no-slop"}],
}))
(root / "project").mkdir()
PY
  cd "$plugin_test_dir/project"
  claude --version
  claude plugin validate "$plugin_test_dir/marketplace/plugins/visual-no-slop" --strict --json
  claude plugin marketplace add "$plugin_test_dir/marketplace" --json
  claude plugin install visual-no-slop@visual-no-slop-packaging-test --scope user --json
  claude plugin list --json
  claude plugin uninstall visual-no-slop@visual-no-slop-packaging-test --scope user --json
  claude plugin list --json
  claude plugin marketplace remove visual-no-slop-packaging-test --json
)
```

Before offering the plugin through a host or directory:

- [ ] Check the portable manifest against its schema.
- [ ] Check the target host's additional requirements; resolve referenced paths from a clean extraction.
- [ ] Install through the host's supported route in an isolated environment. Record the host and version, confirm skill discovery and run a representative task with the bundled references available.
- [ ] Check the host's supported removal route and record the result.
- [ ] If directory publication is requested, prepare its required listing fields and assets, then submit through the supported channel. Track submission, review and approval as separate states.
- [ ] Add an installation badge, listing link or compatibility claim only after the relevant host or directory result is confirmed.

The current candidate has the isolated Claude Code installation/removal evidence above; see [directory preparation](claude-directory.md) for the expanded package and the remaining account-dependent checks. Preserve concurrent producer changes and their run records during publication. The producer's [runbook](../automation/visual-signals/RUNBOOK.md) records its separate operation and schedule evidence; publishing the consumer package does not deploy or restart it.
