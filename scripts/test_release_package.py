#!/usr/bin/env python3
"""Focused tests for portable, deterministic release packaging."""

import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

import build_release
import check_package


ROOT = Path(__file__).resolve().parents[1]


def _zip_contents(path):
    with zipfile.ZipFile(path, "r") as archive:
        return {info.filename: archive.read(info) for info in archive.infolist()}


class ReleasePackageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.workspace = Path(cls.temporary.name)
        cls.repository = cls.workspace / "repository"
        shutil.copytree(
            ROOT,
            cls.repository,
            ignore=shutil.ignore_patterns(
                ".git", ".agents", ".codex", ".pytest_cache", "__pycache__", "node_modules"
            ),
        )
        subprocess.run(
            ["git", "init", "-q", "-b", "main"],
            cwd=cls.repository,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        subprocess.run(
            ["git", "add", "--all"],
            cwd=cls.repository,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        cls.first_output = cls.workspace / "first"
        cls.first_result = build_release.build_release(cls.repository, cls.first_output)
        cls.inventory = build_release.tracked_inventory(cls.repository)
        cls.version = cls.first_result["version"]

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def test_package_portability_check_passes(self):
        result = check_package.validate(ROOT)
        self.assertTrue(result["passed"], result["errors"])
        self.assertEqual(self.version, result["version"])
        self.assertGreater(result["relative_links_checked"], 0)

    def test_all_archive_layouts_and_skill_bytes_are_exact(self):
        version = self.version
        inventory = {path: data for path, _mode, data in self.inventory}
        full_name = "visual-no-slop-{}.zip".format(version)
        plugin_name = "visual-no-slop-{}-plugin.zip".format(version)
        skill_name = "visual-no-slop-{}-skill.zip".format(version)

        full = _zip_contents(self.first_output / full_name)
        plugin = _zip_contents(self.first_output / plugin_name)
        skill = _zip_contents(self.first_output / skill_name)

        prefix = "visual-no-slop-{}/".format(version)
        self.assertEqual(set(full), {prefix + path for path in inventory})
        self.assertEqual(
            set(plugin),
            {
                path
                for path in inventory
                if path in {"LICENSE", "plugin.json"}
                or path.startswith(build_release.SKILL_PREFIX)
            },
        )
        self.assertEqual(
            set(skill),
            {
                path[len("skills/") :]
                for path in inventory
                if path.startswith(build_release.SKILL_PREFIX)
            },
        )
        self.assertEqual({name for name in plugin if "/" not in name}, {"LICENSE", "plugin.json"})
        self.assertIn("visual-no-slop/SKILL.md", skill)
        self.assertIn("visual-no-slop/LICENSE", skill)

        installed_sources = {
            path: data
            for path, data in inventory.items()
            if path.startswith(build_release.SKILL_PREFIX)
        }
        for path, source_data in installed_sources.items():
            self.assertEqual(full[prefix + path], source_data)
            self.assertEqual(plugin[path], source_data)
            self.assertEqual(skill[path[len("skills/") :]], source_data)

        checksum_lines = (self.first_output / build_release.CHECKSUM_NAME).read_text(
            encoding="ascii"
        ).splitlines()
        self.assertEqual(len(checksum_lines), 3)
        for line in checksum_lines:
            digest, filename = line.split("  ", 1)
            actual = hashlib.sha256((self.first_output / filename).read_bytes()).hexdigest()
            self.assertEqual(digest, actual)

    def test_repeated_build_is_byte_for_byte_reproducible_and_read_only(self):
        before = build_release.tracked_inventory(self.repository)
        second_output = self.workspace / "second"
        build_release.build_release(self.repository, second_output)
        after = build_release.tracked_inventory(self.repository)
        self.assertEqual(before, after)
        self.assertEqual(
            sorted(path.name for path in self.first_output.iterdir()),
            sorted(path.name for path in second_output.iterdir()),
        )
        for first in self.first_output.iterdir():
            self.assertEqual(
                first.read_bytes(), (second_output / first.name).read_bytes(), first.name
            )

    def test_existing_artifact_is_not_overwritten(self):
        output = self.workspace / "collision"
        output.mkdir()
        filename = "visual-no-slop-{}.zip".format(self.version)
        sentinel = b"unrelated existing data"
        (output / filename).write_bytes(sentinel)
        with self.assertRaisesRegex(build_release.ReleaseError, "refusing to overwrite"):
            build_release.build_release(self.repository, output)
        self.assertEqual((output / filename).read_bytes(), sentinel)
        self.assertEqual({path.name for path in output.iterdir()}, {filename})

    def test_output_cannot_overlap_source(self):
        with self.assertRaisesRegex(build_release.ReleaseError, "must not contain"):
            build_release._check_output_boundary(
                self.repository, self.repository / "release-output"
            )
        with self.assertRaisesRegex(build_release.ReleaseError, "must not contain"):
            build_release._check_output_boundary(self.repository, self.repository.parent)

    def test_unsafe_archive_entry_is_rejected(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as archive:
            info = zipfile.ZipInfo("../escape.txt", build_release.ARCHIVE_TIMESTAMP)
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, b"escape")
        expected = (("../escape.txt", 0o100644, b"escape"),)
        with self.assertRaisesRegex(build_release.ReleaseError, "unsafe repository path"):
            build_release._validate_archive(buffer.getvalue(), expected)

    def test_tracked_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            repository = Path(directory)
            subprocess.run(
                ["git", "init", "-q", "-b", "main"],
                cwd=repository,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            (repository / "target.txt").write_text("target", encoding="utf-8")
            (repository / "unsafe-link").symlink_to("target.txt")
            subprocess.run(
                ["git", "add", "target.txt", "unsafe-link"],
                cwd=repository,
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            with self.assertRaisesRegex(build_release.ReleaseError, "tracked symlink"):
                build_release.tracked_inventory(repository)

    def test_corrupted_release_fails_verification(self):
        output = self.workspace / "corrupt"
        build_release.build_release(self.repository, output)
        plugin = output / "visual-no-slop-{}-plugin.zip".format(self.version)
        with zipfile.ZipFile(plugin, "a") as archive:
            archive.writestr("unexpected.txt", b"not in the release plan")
        with self.assertRaisesRegex(
            build_release.ReleaseError, "archive (?:has a non-deterministic timestamp|paths differ)"
        ):
            build_release.verify_release(self.repository, output)

    def test_cli_result_is_machine_readable(self):
        output = self.workspace / "cli"
        completed = subprocess.run(
            [
                "python3",
                str(self.repository / "scripts" / "build_release.py"),
                "--output",
                str(output),
            ],
            cwd=self.repository,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        result = json.loads(completed.stdout)
        self.assertTrue(result["passed"])
        self.assertEqual(result["version"], self.version)
        self.assertEqual(len(result["artifacts"]), 3)
        self.assertEqual(result["checksums"], build_release.CHECKSUM_NAME)


if __name__ == "__main__":
    unittest.main(verbosity=2)
