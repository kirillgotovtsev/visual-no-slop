# Publishing Visual no-slop

This is the first-release checklist for local candidate **1.2.0**. The planned GitHub repository, `kirillgotovtsev/visual-no-slop`, is unpublished. No skills.sh listing, plugin host installation or plugin-directory submission is verified.

The package supports a GitHub-based skill release and a separate optional plugin channel. Preparing the plugin files does not publish either channel.

## Prepare the release files

- [x] Check that the README, `SKILL.md` metadata, changelog and `plugin.json` identify the same version.
- [x] Include the final `LICENSE` at the repository root and inside `skills/visual-no-slop/`, so an installation of that folder retains the terms and attribution.
- [x] Verify all relative links and bundled reference paths from the files that use them. Remove author-machine paths, temporary files and private material from the release package.
- [x] Keep the examples' provenance with their images. Describe them as authored teaching fixtures with agent revisions; preserve the audit-only counterexample that retains justified cards.
- [x] Check that the license summary matches the full terms: paid client work is allowed, free redistribution requires an unmodified copy and attribution, and ordinary outputs need no author credit. Do not describe this custom restrictive license as open source.
- [x] Update `VALIDATION.md` with the actual commands, environment, results and limits. Preserve the distinction between packaging checks, visual inspection and controlled outcome evidence.
- [x] Review the final public prose and inspect the actual example images. Record any part that remains unverified.

## Verify the local package

Run `python3 scripts/check_package.py` from the package root for version, attribution, license, example and local-link consistency. The current local installation and visual checks are recorded in [VALIDATION.md](../VALIDATION.md).

Use a fresh temporary project to avoid replacing an existing installation. Run discovery, installation, listing and removal with the tested CLI version, then compare the installed files with the package, including the license. Record the tool versions used.

Run representative visual tasks using the installed package without access to the author's chat history. Include a task where a commonly criticized device is justified. Record the request, inputs, host, model, resulting artifact and verification limits before making compatibility or outcome claims.

The included teaching fixtures explain the method. They do not establish a measured improvement against a no-skill baseline. A controlled comparison would require its own design and evidence.

## Publish the GitHub skill

Once publication is authorized:

1. Create the public repository at `kirillgotovtsev/visual-no-slop`. Put this package at the repository root so `skills/visual-no-slop/SKILL.md` resolves at the documented path on `main`.
2. Set the repository description and topics below. Keep the custom license file; do not substitute a standard open-source license from a repository template.
3. Push the candidate files and check the public README, relative links, images, license and skill path in GitHub.
4. Test the documented GitHub install in a fresh project. Confirm that discovery finds `visual-no-slop`, the expected files are installed, Codex lists the skill, and a representative invocation can read its bundled references.
5. Check the documented update and removal commands. A first-release “already current” result does not test replacement by a later version. Test user-wide installation separately in an isolated user environment before claiming it works.
6. Test the Codex `$skill-installer` GitHub route separately. Earlier helper checks cover URL parsing, local validation and copying; they do not establish its complete network installation flow.
7. Record the remote results and remaining limits in `VALIDATION.md`. Update the README's candidate status and unavailable-path notice only to match what is now published and verified.
8. Tag the reviewed release as `v1.2.0`, create the GitHub release and attach the intended archives. Confirm that each archive contains the version, license, attribution and source reference, and that its files match the tagged package.

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

The root [plugin.json](../plugin.json) describes a local skill-only plugin candidate. The optional `visual-no-slop-1.2.0-plugin.zip` archive contains the manifest, root license and installable skill. It is prepared outside the repository; it has no in-repository download link. The full package archive is `visual-no-slop-1.2.0.zip`.

Before offering the plugin through a host or directory:

- [x] Check the portable manifest against its schema.
- [ ] Check the target host's additional requirements; resolve referenced paths from a clean extraction.
- [ ] Install through the host's supported route in an isolated environment. Record the host and version, confirm skill discovery and run a representative task with the bundled references available.
- [ ] Check the host's supported removal route and record the result.
- [ ] If directory publication is requested, prepare its required listing fields and assets, then submit through the supported channel. Track submission, review and approval as separate states.
- [ ] Add an installation badge, listing link or compatibility claim only after the relevant host or directory result is confirmed.

The current candidate has no verified plugin host installation or directory submission. Keep those limits in the release record until the corresponding checks are complete. Weekly research and automatic updating remain deferred work, outside this release.
