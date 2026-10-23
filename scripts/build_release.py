#!/usr/bin/env python3
"""Build and verify deterministic Visual no-slop release archives."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import unicodedata
import zipfile

import check_package


ARCHIVE_TIMESTAMP = (1980, 1, 1, 0, 0, 0)
CHECKSUM_NAME = "SHA256SUMS"
SKILL_PREFIX = "skills/visual-no-slop/"
IGNORED_PARTS = {
    ".agents",
    ".codex",
    ".git",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
}
SENSITIVE_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    "credentials.json",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "id_rsa",
    "secrets.json",
}
SENSITIVE_SUFFIXES = {".key", ".p12", ".pem", ".pfx"}
HTML_REFERENCE_PATTERN = re.compile(r"(?:src|href)=[\"']([^\"']+)[\"']")


class ReleaseError(RuntimeError):
    """Raised when the source or generated release is unsafe or inconsistent."""


def _git(root, *arguments):
    completed = subprocess.run(
        ["git", "-C", str(root), *arguments],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        env=dict(os.environ, LC_ALL="C"),
    )
    if completed.returncode:
        message = completed.stderr.decode("utf-8", "replace").strip()
        raise ReleaseError("git {} failed: {}".format(" ".join(arguments), message))
    return completed.stdout


def _safe_relative_path(raw):
    if (
        not raw
        or "\\" in raw
        or "\x00" in raw
        or any(ord(character) < 32 for character in raw)
        or re.match(r"^[A-Za-z]:", raw)
    ):
        raise ReleaseError("unsafe repository path: {!r}".format(raw))
    if any("\ud800" <= character <= "\udfff" for character in raw):
        raise ReleaseError("repository path is not valid UTF-8: {!r}".format(raw))
    path = PurePosixPath(raw)
    if path.is_absolute() or raw != path.as_posix() or any(
        part in {"", ".", ".."} for part in path.parts
    ):
        raise ReleaseError("unsafe repository path: {!r}".format(raw))
    reserved = {"aux", "con", "nul", "prn"}
    for part in path.parts:
        stem = part.split(".", 1)[0].casefold()
        if (
            part.endswith((" ", "."))
            or stem in reserved
            or re.fullmatch(r"(?:com|lpt)[1-9]", stem)
        ):
            raise ReleaseError("non-portable repository path: {!r}".format(raw))
    return path


def _portable_path_key(path):
    return unicodedata.normalize("NFC", path).casefold()


def _reject_irrelevant_or_sensitive(path):
    lowered_parts = tuple(part.casefold() for part in path.parts)
    if any(part in IGNORED_PARTS for part in lowered_parts):
        raise ReleaseError("tracked cache or local metadata is not releasable: " + path.as_posix())
    name = lowered_parts[-1]
    if name in SENSITIVE_NAMES or PurePosixPath(name).suffix in SENSITIVE_SUFFIXES:
        raise ReleaseError("tracked sensitive file is not releasable: " + path.as_posix())


def tracked_inventory(root):
    """Return sorted tracked files as (path, mode, bytes), rejecting unsafe entries."""
    root = Path(root).resolve()
    top = Path(os.fsdecode(_git(root, "rev-parse", "--show-toplevel")).strip()).resolve()
    if top != root:
        raise ReleaseError("release root is not the Git worktree root: " + str(root))

    entries = []
    seen = set()
    portable_seen = set()
    records = _git(root, "ls-files", "--stage", "-z").split(b"\x00")
    for record in records:
        if not record:
            continue
        try:
            header, raw_path = record.split(b"\t", 1)
            mode_bytes, _object_id, stage = header.split(b" ", 2)
        except ValueError as exc:
            raise ReleaseError("cannot parse git tracked-file inventory") from exc
        path_text = os.fsdecode(raw_path)
        path = _safe_relative_path(path_text)
        if path.as_posix() in seen:
            raise ReleaseError("duplicate tracked path: " + path.as_posix())
        seen.add(path.as_posix())
        portable_key = _portable_path_key(path.as_posix())
        if portable_key in portable_seen:
            raise ReleaseError("case or Unicode-colliding tracked path: " + path.as_posix())
        portable_seen.add(portable_key)
        if stage != b"0":
            raise ReleaseError("unmerged tracked path: " + path.as_posix())
        try:
            git_mode = int(mode_bytes, 8)
        except ValueError as exc:
            raise ReleaseError("invalid Git mode for " + path.as_posix()) from exc
        if stat.S_IFMT(git_mode) == stat.S_IFLNK:
            raise ReleaseError("tracked symlink is not releasable: " + path.as_posix())
        if git_mode not in {0o100644, 0o100755}:
            raise ReleaseError(
                "unsupported tracked entry mode {:o}: {}".format(git_mode, path.as_posix())
            )
        _reject_irrelevant_or_sensitive(path)

        source = root.joinpath(*path.parts)
        cursor = root
        for part in path.parts:
            cursor = cursor / part
            if cursor.is_symlink():
                raise ReleaseError("source path traverses a symlink: " + path.as_posix())
        resolved = source.resolve()
        if not resolved.is_relative_to(root) or not source.is_file():
            raise ReleaseError("tracked source is missing or escaping: " + path.as_posix())
        entries.append((path.as_posix(), git_mode, source.read_bytes()))
    if not entries:
        raise ReleaseError("repository tracked-file inventory is empty")
    return tuple(sorted(entries, key=lambda item: item[0]))


def _sha256(data):
    return hashlib.sha256(data).hexdigest()


def _archive_bytes(entries):
    """Create one deterministic ZIP from (archive path, mode, bytes) entries."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(
        buffer,
        mode="w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
        strict_timestamps=True,
    ) as archive:
        for name, mode, data in sorted(entries, key=lambda item: item[0]):
            _safe_relative_path(name)
            info = zipfile.ZipInfo(name, ARCHIVE_TIMESTAMP)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = mode << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return buffer.getvalue()


def _validate_inventory_reference_closure(root, inventory):
    """Ensure tracked release documents do not depend on untracked local files."""
    tracked = {path for path, _mode, _data in inventory}
    for path, _mode, data in inventory:
        suffix = PurePosixPath(path).suffix.lower()
        if suffix not in {".html", ".md"}:
            continue
        try:
            content = data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ReleaseError("release document is not UTF-8: " + path) from exc
        targets = []
        if suffix == ".md":
            targets.extend(check_package.MARKDOWN_LINK_PATTERN.findall(content))
            if path.startswith(SKILL_PREFIX):
                targets.extend(check_package.INLINE_SKILL_PATH_PATTERN.findall(content))
        else:
            targets.extend(HTML_REFERENCE_PATTERN.findall(content))
        source = root.joinpath(*PurePosixPath(path).parts)
        for target in targets:
            local = check_package._local_reference(target)
            if local is None or "\\" in local:
                continue
            resolved = (source.parent / local).resolve()
            if resolved.is_file() and resolved.is_relative_to(root):
                relative = resolved.relative_to(root).as_posix()
                if relative not in tracked:
                    raise ReleaseError(
                        "tracked document {} references untracked release file {}".format(
                            path, relative
                        )
                    )


def _release_plan(root):
    validation = check_package.validate(root)
    if not validation["passed"]:
        raise ReleaseError("package validation failed: " + "; ".join(validation["errors"]))
    version = validation["version"]
    inventory = tracked_inventory(root)
    _validate_inventory_reference_closure(root, inventory)
    full_prefix = "visual-no-slop-{}/".format(version)

    full_entries = tuple((full_prefix + path, mode, data) for path, mode, data in inventory)
    plugin_entries = tuple(
        (path, mode, data)
        for path, mode, data in inventory
        if path in {"LICENSE", "plugin.json"} or path.startswith(SKILL_PREFIX)
    )
    skill_entries = tuple(
        (path[len("skills/") :], mode, data)
        for path, mode, data in inventory
        if path.startswith(SKILL_PREFIX)
    )
    if {name for name, _mode, _data in plugin_entries if "/" not in name} != {
        "LICENSE",
        "plugin.json",
    }:
        raise ReleaseError("plugin archive root must contain plugin.json and LICENSE")
    if not any(name == "visual-no-slop/SKILL.md" for name, _mode, _data in skill_entries):
        raise ReleaseError("skill archive would not contain visual-no-slop/SKILL.md")
    if not any(name == "visual-no-slop/LICENSE" for name, _mode, _data in skill_entries):
        raise ReleaseError("skill archive would not contain visual-no-slop/LICENSE")

    artifacts = (
        ("visual-no-slop-{}.zip".format(version), full_entries),
        ("visual-no-slop-{}-plugin.zip".format(version), plugin_entries),
        ("visual-no-slop-{}-skill.zip".format(version), skill_entries),
    )
    return version, inventory, artifacts


def _check_output_boundary(root, output):
    root = Path(root).resolve()
    output = Path(output).resolve()
    if output == root or output.is_relative_to(root) or root.is_relative_to(output):
        raise ReleaseError("output directory must not contain or be contained by the source root")
    return output


def _validate_archive(data, expected_entries):
    expected = {name: (mode, payload) for name, mode, payload in expected_entries}
    if len(expected) != len(expected_entries):
        raise ReleaseError("expected archive plan contains duplicate paths")
    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as archive:
            infos = archive.infolist()
            names = [info.filename for info in infos]
            if len(names) != len(set(names)):
                raise ReleaseError("archive contains duplicate paths")
            if len(names) != len({_portable_path_key(name) for name in names}):
                raise ReleaseError("archive contains case or Unicode-colliding paths")
            for info in infos:
                _safe_relative_path(info.filename)
                entry_type = stat.S_IFMT(info.external_attr >> 16)
                if entry_type == stat.S_IFLNK:
                    raise ReleaseError("archive contains a symlink: " + info.filename)
                if info.is_dir():
                    raise ReleaseError(
                        "archive contains an unexpected directory entry: " + info.filename
                    )
                if info.date_time != ARCHIVE_TIMESTAMP:
                    raise ReleaseError(
                        "archive has a non-deterministic timestamp: " + info.filename
                    )
            if names != sorted(expected):
                raise ReleaseError("archive paths differ from the release inventory")
            for info in infos:
                expected_mode, expected_data = expected[info.filename]
                if info.external_attr >> 16 != expected_mode:
                    raise ReleaseError("archive mode differs for " + info.filename)
                if archive.read(info) != expected_data:
                    raise ReleaseError("archive content differs for " + info.filename)
    except (OSError, zipfile.BadZipFile, KeyError) as exc:
        raise ReleaseError("invalid release archive: " + str(exc)) from exc


def verify_release(root, output):
    """Verify archive safety, exact source bytes, layouts and checksum file."""
    root = Path(root).resolve()
    output = _check_output_boundary(root, output)
    version, _inventory, artifacts = _release_plan(root)
    digests = {}
    for filename, expected_entries in artifacts:
        path = output / filename
        try:
            data = path.read_bytes()
        except OSError as exc:
            raise ReleaseError("cannot read release artifact {}: {}".format(filename, exc)) from exc
        _validate_archive(data, expected_entries)
        digests[filename] = _sha256(data)

    expected_checksums = "".join(
        "{}  {}\n".format(digests[filename], filename) for filename, _entries in artifacts
    ).encode("ascii")
    try:
        actual_checksums = (output / CHECKSUM_NAME).read_bytes()
    except OSError as exc:
        raise ReleaseError("cannot read {}: {}".format(CHECKSUM_NAME, exc)) from exc
    if actual_checksums != expected_checksums:
        raise ReleaseError(CHECKSUM_NAME + " does not match the three release archives")
    return {"version": version, "artifacts": digests, "checksums": CHECKSUM_NAME}


def build_release(root, output):
    """Build all artifacts atomically enough to avoid overwriting unrelated files."""
    root = Path(root).resolve()
    output = _check_output_boundary(root, output)
    version, initial_inventory, artifact_plan = _release_plan(root)
    archive_data = tuple(
        (filename, _archive_bytes(entries)) for filename, entries in artifact_plan
    )
    digest_lines = "".join(
        "{}  {}\n".format(_sha256(data), filename) for filename, data in archive_data
    ).encode("ascii")
    payloads = archive_data + ((CHECKSUM_NAME, digest_lines),)

    output.mkdir(parents=True, exist_ok=True)
    collisions = [filename for filename, _data in payloads if (output / filename).exists()]
    if collisions:
        raise ReleaseError(
            "refusing to overwrite existing release path(s): " + ", ".join(collisions)
        )

    created = []
    try:
        for filename, data in payloads:
            path = output / filename
            with path.open("xb") as handle:
                handle.write(data)
            created.append(path)
        if tracked_inventory(root) != initial_inventory:
            raise ReleaseError("tracked source changed while the release was being built")
        return verify_release(root, output)
    except Exception:
        for path in reversed(created):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", required=True, type=Path, help="directory for release artifacts"
    )
    arguments = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    try:
        result = build_release(root, arguments.output)
    except ReleaseError as exc:
        print(json.dumps({"passed": False, "error": str(exc)}, indent=2), file=sys.stderr)
        return 1
    result["passed"] = True
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
