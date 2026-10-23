#!/usr/bin/env python3
"""Check portable release-file consistency without network access or dependencies.

The frontmatter reader intentionally supports the small scalar-and-metadata subset
used by this repository. It is not a general YAML validator.
"""

import json
import os
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit


PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
PLUGIN_LICENSE = "LicenseRef-Visual-No-Slop-1.0"
SKILL_LICENSE = "Visual No-Slop License 1.0; see LICENSE"
SOURCE = "https://github.com/kirillgotovtsev/visual-no-slop"
HOMEPAGE = "https://gotovtsev.ru/visual-no-slop"
IGNORED_DIRECTORIES = {
    ".git",
    ".agents",
    ".codex",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
}
TEXT_SUFFIXES = {".md", ".html", ".json", ".yaml", ".yml", ".mjs", ".py", ".txt"}
NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
STANDARD_SKILL_FIELDS = {
    "allowed-tools",
    "compatibility",
    "description",
    "license",
    "metadata",
    "name",
}
SEMVER_PATTERN = re.compile(
    r"^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)"
    r"(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)
MARKDOWN_LINK_PATTERN = re.compile(r"!?\[[^\]\n]*\]\(([^)\n]+)\)")
INLINE_SKILL_PATH_PATTERN = re.compile(
    r"`((?:agents|references|scripts)/[^`\s]+\.(?:md|mjs|py|yaml|yml|json))`"
)
MACHINE_PATH_PATTERN = re.compile(
    r"/(?:Users|private/tmp|home/[^ /]+)/|[A-Za-z]:[\\/]Users[\\/]"
)
COMPATIBILITY_TERMS = {
    "agent",
    "browser",
    "host",
    "image",
    "network",
    "node",
    "playback",
    "requires",
    "supports",
    "tool",
    "visual",
}


class FrontmatterError(ValueError):
    """Raised when the repository's controlled frontmatter format is invalid."""


def _parse_scalar(raw, line_number):
    value = raw.strip()
    if not value:
        raise FrontmatterError("empty scalar on frontmatter line {}".format(line_number))
    if value.startswith('"'):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as exc:
            raise FrontmatterError(
                "invalid quoted scalar on frontmatter line {}: {}".format(line_number, exc.msg)
            ) from exc
        if not isinstance(parsed, str):
            raise FrontmatterError(
                "frontmatter line {} must contain a string".format(line_number)
            )
        return parsed
    if value.startswith("'"):
        if len(value) < 2 or not value.endswith("'"):
            raise FrontmatterError(
                "invalid single-quoted scalar on frontmatter line {}".format(line_number)
            )
        return value[1:-1].replace("''", "'")
    return value


def parse_skill_frontmatter(text):
    """Parse the controlled frontmatter subset used by this skill package."""
    lines = text.splitlines()
    if not lines or lines[0] != "---":
        raise FrontmatterError("SKILL.md must start with a frontmatter delimiter")
    try:
        closing = lines.index("---", 1)
    except ValueError as exc:
        raise FrontmatterError("SKILL.md frontmatter has no closing delimiter") from exc

    result = {}
    current_mapping = None
    for index, line in enumerate(lines[1:closing], start=2):
        if not line.strip():
            continue
        if line.startswith("  "):
            if current_mapping is None:
                raise FrontmatterError(
                    "unexpected nested value on frontmatter line {}".format(index)
                )
            match = re.fullmatch(r"  ([A-Za-z0-9_-]+):\s*(.+)", line)
            if not match:
                raise FrontmatterError(
                    "unsupported nested frontmatter syntax on line {}".format(index)
                )
            key, raw = match.groups()
            if key in current_mapping:
                raise FrontmatterError(
                    "duplicate metadata key {!r} on line {}".format(key, index)
                )
            current_mapping[key] = _parse_scalar(raw, index)
            continue

        match = re.fullmatch(r"([A-Za-z0-9_-]+):(?:\s*(.*))?", line)
        if not match:
            raise FrontmatterError(
                "unsupported frontmatter syntax on line {}".format(index)
            )
        key, raw = match.groups()
        if key in result:
            raise FrontmatterError("duplicate frontmatter key {!r}".format(key))
        if raw:
            result[key] = _parse_scalar(raw, index)
            current_mapping = None
        else:
            result[key] = {}
            current_mapping = result[key]
    return result


def _portable_files(root, errors):
    """Yield package files without traversing ignored local/tool directories."""
    for directory, directory_names, file_names in os.walk(root, followlinks=False):
        base = Path(directory)
        retained = []
        for name in sorted(directory_names):
            path = base / name
            relative = path.relative_to(root).as_posix()
            if name in IGNORED_DIRECTORIES:
                continue
            if path.is_symlink():
                errors.append("Release contains a symlink: " + relative)
                continue
            retained.append(name)
        directory_names[:] = retained
        for name in sorted(file_names):
            path = base / name
            relative = path.relative_to(root).as_posix()
            if path.is_symlink():
                errors.append("Release contains a symlink: " + relative)
                continue
            yield path


def _local_reference(target):
    target = target.strip()
    if target.startswith("<") and target.endswith(">"):
        target = target[1:-1]
    parsed = urlsplit(target)
    if parsed.scheme or parsed.netloc or not parsed.path:
        return None
    return unquote(parsed.path)


def _check_reference(file, target, root, skill, errors):
    relative = file.relative_to(root).as_posix()
    local = _local_reference(target)
    if local is None:
        return False
    if "\\" in local:
        errors.append(relative + ": non-portable reference " + target)
        return True
    resolved = (file.parent / local).resolve()
    boundary = skill if file.is_relative_to(skill) else root
    if not resolved.is_relative_to(boundary.resolve()) or not resolved.exists():
        errors.append(relative + ": missing or escaping target " + target)
    return True


def validate(root):
    """Return a JSON-serializable package validation result."""
    root = Path(root).resolve()
    errors = []
    checked_links = 0
    skill = root / "skills" / "visual-no-slop"

    try:
        plugin = json.loads((root / "plugin.json").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        plugin = {}
        errors.append("Cannot read plugin.json: " + str(exc))
    try:
        metadata = parse_skill_frontmatter((skill / "SKILL.md").read_text(encoding="utf-8"))
    except (OSError, UnicodeError, FrontmatterError) as exc:
        metadata = {}
        errors.append("Cannot read portable SKILL.md metadata: " + str(exc))

    plugin_version = plugin.get("version")
    skill_metadata = metadata.get("metadata")
    if not isinstance(skill_metadata, dict):
        errors.append("Skill metadata must be a string mapping.")
        skill_metadata = {}
    skill_version = skill_metadata.get("version")
    if not isinstance(plugin_version, str) or not SEMVER_PATTERN.fullmatch(plugin_version):
        errors.append("Plugin version is not a portable semantic version.")
    if skill_version != plugin_version:
        errors.append("Skill and plugin versions differ.")

    if plugin.get("$schema") != PLUGIN_SCHEMA:
        errors.append("Unexpected plugin schema identifier.")
    if plugin.get("name") != skill.name or metadata.get("name") != skill.name:
        errors.append("Plugin, skill metadata and skill directory names differ.")
    if not isinstance(metadata.get("name"), str) or not NAME_PATTERN.fullmatch(
        metadata.get("name", "")
    ) or len(metadata.get("name", "")) > 64:
        errors.append("Skill name is not portable lowercase-hyphen metadata.")
    unexpected_fields = sorted(set(metadata) - STANDARD_SKILL_FIELDS)
    if unexpected_fields:
        errors.append(
            "Unexpected non-standard skill metadata field(s): " + ", ".join(unexpected_fields)
        )

    for label, description in (
        ("Plugin", plugin.get("description")),
        ("Skill", metadata.get("description")),
    ):
        if not isinstance(description, str) or not description.strip():
            errors.append(label + " description is missing.")
        elif len(description) > 200:
            errors.append(label + " description exceeds the package policy of 200 characters.")

    compatibility = metadata.get("compatibility")
    if not isinstance(compatibility, str) or not compatibility.strip():
        errors.append("Skill compatibility metadata is missing.")
    elif len(compatibility) > 500:
        errors.append("Skill compatibility metadata exceeds 500 characters.")
    else:
        normalized = compatibility.strip().lower()
        words = set(re.findall(r"[a-z]+", normalized))
        if len(normalized) < 20 or normalized in {
            "all",
            "any",
            "n/a",
            "none",
            "tbd",
            "universal",
            "unknown",
        } or not words.intersection(COMPATIBILITY_TERMS):
            errors.append(
                "Skill compatibility metadata does not state a meaningful environment requirement."
            )

    expected_metadata = {
        "author": plugin.get("author", {}).get("name")
        if isinstance(plugin.get("author"), dict)
        else None,
        "homepage": plugin.get("homepage"),
        "source": plugin.get("repository"),
    }
    if plugin.get("license") != PLUGIN_LICENSE:
        errors.append("Unexpected plugin license identifier.")
    if metadata.get("license") != SKILL_LICENSE:
        errors.append("Unexpected skill license reference.")
    if expected_metadata["author"] != "Kirill Gotovtsev":
        errors.append("Unexpected plugin author attribution.")
    if expected_metadata["source"] != SOURCE:
        errors.append("Unexpected plugin source repository.")
    if expected_metadata["homepage"] != HOMEPAGE:
        errors.append("Unexpected plugin homepage.")
    for key, expected in expected_metadata.items():
        if skill_metadata.get(key) != expected:
            errors.append("Skill and plugin {} metadata differ.".format(key))

    try:
        root_license = (root / "LICENSE").read_bytes()
        installed_license = (skill / "LICENSE").read_bytes()
        if root_license != installed_license:
            errors.append("Installed license differs from repository license.")
        if b"DRAFT FOR REVIEW" in root_license:
            errors.append("An ineffective draft is in the license path.")
    except OSError as exc:
        errors.append("Cannot read bundled license files: " + str(exc))

    for file in _portable_files(root, errors):
        relative = file.relative_to(root).as_posix()
        if file.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            content = file.read_text(encoding="utf-8")
        except (OSError, UnicodeError) as exc:
            errors.append("Cannot read portable text file {}: {}".format(relative, exc))
            continue
        if MACHINE_PATH_PATTERN.search(content):
            errors.append("Machine-specific path in " + relative)
        if file.suffix.lower() == ".md":
            targets = list(MARKDOWN_LINK_PATTERN.findall(content))
            if file.is_relative_to(skill):
                targets.extend(INLINE_SKILL_PATH_PATTERN.findall(content))
            for target in targets:
                if _check_reference(file, target, root, skill, errors):
                    checked_links += 1
        if file.suffix.lower() == ".html" and re.search(
            r"(?:src|href)=[\"']https?://", content
        ):
            errors.append("Remote dependency in example: " + relative)

    for case in ("print-workshop", "project-update"):
        for name in ("before.html", "after.html", "before.png", "after.png", "brief.md"):
            if not (root / "examples" / case / name).is_file():
                errors.append("Missing example artifact: " + case + "/" + name)
    for name in ("before.html", "before.png", "brief.md", "audit.md"):
        if not (root / "examples" / "justified-cards" / name).is_file():
            errors.append("Missing audit-only example artifact: " + name)

    return {
        "version": plugin_version,
        "relative_links_checked": checked_links,
        "errors": errors,
        "passed": not errors,
    }


def check(root):
    result = validate(root)
    print(json.dumps(result, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(check(Path(__file__).resolve().parents[1]))
