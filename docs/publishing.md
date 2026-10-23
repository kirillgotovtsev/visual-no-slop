# Publishing Visual no-slop

Use this checklist for releases of `kirillgotovtsev/visual-no-slop`. Version **1.4.0** adds cross-agent installation guidance and a skill ZIP alongside the full and plugin archives. [VALIDATION.md](../VALIDATION.md) and the [compatibility record](compatibility.md) distinguish completed checks from documented routes and unverified host behavior.

The official project page is [gotovtsev.ru/visual-no-slop](https://gotovtsev.ru/visual-no-slop). Use this address in the GitHub Website field, the README, release notes, and the skill and plugin homepage metadata. Keep the GitHub repository as the source and installation address.

Keep one canonical skill at `skills/visual-no-slop/`. All installation routes distribute that folder unchanged. Host instructions belong in the documentation; do not maintain separate copies of the review method for different agents.

## Prepare the release files

- Check that the README, `SKILL.md` metadata, changelog and `plugin.json` identify the same version.
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
| `visual-no-slop-1.4.0-plugin.zip` | Optional plugin candidate with `plugin.json`, `LICENSE` and `skills/visual-no-slop/` at the archive root |
| `visual-no-slop-1.4.0-skill.zip` | One `visual-no-slop/` folder for Claude upload or manual installation |

The skill archive must contain `visual-no-slop/SKILL.md`, with `eval.md`, `LICENSE`, `references/`, `scripts/` and `agents/openai.yaml` inside that same folder. It must have no extra repository wrapper or plugin manifest. Compare every extracted skill file against `skills/visual-no-slop/`; all three archives must carry the same canonical skill and license. The builder writes `SHA256SUMS` beside the archives, with each SHA-256 hash followed by two spaces and its archive filename. Verify clean extraction, relative paths and checksums before attaching the archives to a release.

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
npx --yes skills@latest add kirillgotovtsev/visual-no-slop --skill visual-no-slop -a codex -y
npx --yes skills@latest list -a codex --json
npx --yes skills@latest update visual-no-slop --project
npx --yes skills@latest remove visual-no-slop -y
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

The root [plugin.json](../plugin.json) describes a skill-only plugin candidate. Its archive is a separate distribution option; it does not establish compatibility with Claude Code's or Cursor's plugin manifests or marketplaces. Their documented skill-directory routes use the canonical folder without this manifest.

Before offering the plugin through a host or directory:

- [ ] Check the portable manifest against its schema.
- [ ] Check the target host's additional requirements; resolve referenced paths from a clean extraction.
- [ ] Install through the host's supported route in an isolated environment. Record the host and version, confirm skill discovery and run a representative task with the bundled references available.
- [ ] Check the host's supported removal route and record the result.
- [ ] If directory publication is requested, prepare its required listing fields and assets, then submit through the supported channel. Track submission, review and approval as separate states.
- [ ] Add an installation badge, listing link or compatibility claim only after the relevant host or directory result is confirmed.

The current candidate has no verified plugin host installation or directory submission. Keep those limits in the release record until the corresponding checks are complete. Preserve concurrent producer changes and their run records during publication. The producer's [runbook](../automation/visual-signals/RUNBOOK.md) records its separate operation and schedule evidence; publishing the consumer package does not deploy or restart it.
