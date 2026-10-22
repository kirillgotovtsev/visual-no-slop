# Publishing Visual no-slop

Use this checklist for releases of `kirillgotovtsev/visual-no-slop`. Version **1.3.0** is the first public package. [VALIDATION.md](../VALIDATION.md) records the operations actually checked; a plugin manifest or a prepared archive does not establish host or directory acceptance.

The package supports GitHub skill installation and a separate optional plugin channel.

## Prepare the release files

- [x] Check that the README, `SKILL.md` metadata, changelog and `plugin.json` identify the same version.
- [x] Include the final `LICENSE` at the repository root and inside `skills/visual-no-slop/`, so an installation of that folder retains the terms and attribution.
- [x] Verify all relative links and bundled reference paths from the files that use them. Remove author-machine paths, temporary files and private material from the release package.
- [x] Keep the examples' provenance with their images. Describe them as authored teaching fixtures with agent revisions; preserve the audit-only counterexample that retains justified cards.
- [x] Check that the license summary matches the full terms: paid client work is allowed, free redistribution requires an unmodified copy and attribution, and ordinary outputs need no author credit. Do not describe this custom restrictive license as open source.
- [x] Update `VALIDATION.md` with the actual commands, environment, results and limits. Preserve the distinction between packaging checks, visual inspection and controlled outcome evidence.
- [x] Review the final public prose and inspect the actual example images. Record any part that remains unverified.

For changes to the current-signals consumer, also run `node --test scripts/test_current_signals.mjs`. Keep the [producer contract](weekly-updates.md#file-contract-for-the-producer) compatible with the installed consumer. Weekly reference updates do not change the stable package version.

## Verify the local package

Run `python3 scripts/check_package.py` from the package root for version, attribution, license, example and local-link consistency. The current local installation and visual checks are recorded in [VALIDATION.md](../VALIDATION.md).

Use a fresh temporary project to avoid replacing an existing installation. Run discovery, installation, listing and removal with the tested CLI version, then compare the installed files with the package, including the license. Record the tool versions used.

Run representative visual tasks using the installed package without access to the author's chat history. Include a task where a commonly criticized device is justified. Record the request, inputs, host, model, resulting artifact and verification limits before making compatibility or outcome claims.

The included teaching fixtures explain the method. They do not establish a measured improvement against a no-skill baseline. A controlled comparison would require its own design and evidence.

## Publish the GitHub skill

For an authorized release:

1. Put this package at the repository root so `skills/visual-no-slop/SKILL.md` resolves at the documented path on `main`. Preserve concurrent changes, including the producer's reference and run records.
2. Set the repository description and topics below. Keep the custom license file; do not substitute a standard open-source license from a repository template.
3. Push the candidate files and check the public README, relative links, images, license and skill path in GitHub.
4. Test the documented GitHub install in a fresh project. Confirm that discovery finds `visual-no-slop`, the expected files are installed, Codex lists the skill, and a representative invocation can read its bundled references.
5. Check the documented update and removal commands. A first-release “already current” result does not test replacement by a later version. Test user-wide installation separately in an isolated user environment before claiming it works.
6. Test the Codex `$skill-installer` GitHub route separately. Earlier helper checks cover URL parsing, local validation and copying; they do not establish its complete network installation flow.
7. Record the remote results and remaining limits in `VALIDATION.md`. Keep the README's feature and compatibility claims within those results.
8. Tag the reviewed release, create the GitHub release and attach the intended archives. Confirm that each archive contains the version, license, attribution and source reference, and that its files match the tagged package. Include SHA-256 checksums and exclude Git metadata, caches, credentials and local task records.

The project-scoped CLI smoke check starts with:

```bash
npx --yes skills@latest add kirillgotovtsev/visual-no-slop --skill visual-no-slop -a codex -y
npx --yes skills@latest list -a codex --json
npx --yes skills@latest update visual-no-slop --project
npx --yes skills@latest remove visual-no-slop -y
```

Use the global and Codex installer instructions in the [README](../README.md#install) for their separate checks. Record a skills.sh listing only after inspecting its public page and install target; keep it out of release claims until then.

### Repository description

```text
An Agent Skill for reviewing and refining composition, typography and imagery while preserving an approved visual direction.
```

### Repository topics

```text
agent-skills, codex, ai-agents, visual-design, design-review, typography, ui-design, presentations, print-design
```

## Optional plugin channel

The root [plugin.json](../plugin.json) describes a skill-only plugin candidate. The optional `visual-no-slop-1.3.0-plugin.zip` archive contains the manifest, root license and installable skill. The full package archive is `visual-no-slop-1.3.0.zip`. Attach them to the corresponding GitHub release after verifying clean extractions.

Before offering the plugin through a host or directory:

- [x] Check the portable manifest against its schema.
- [ ] Check the target host's additional requirements; resolve referenced paths from a clean extraction.
- [ ] Install through the host's supported route in an isolated environment. Record the host and version, confirm skill discovery and run a representative task with the bundled references available.
- [ ] Check the host's supported removal route and record the result.
- [ ] If directory publication is requested, prepare its required listing fields and assets, then submit through the supported channel. Track submission, review and approval as separate states.
- [ ] Add an installation badge, listing link or compatibility claim only after the relevant host or directory result is confirmed.

The current candidate has no verified plugin host installation or directory submission. Keep those limits in the release record until the corresponding checks are complete. The cloud research producer and its schedule have their own setup; publishing the consumer package does not deploy them.
