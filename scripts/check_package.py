#!/usr/bin/env python3
"""Check release-file consistency without installing tools or using the network."""
import json
from pathlib import Path
import re
from urllib.parse import unquote


def check(root):
    errors = []
    checked_links = 0
    skill = root / 'skills' / 'visual-no-slop'
    plugin = json.loads((root / 'plugin.json').read_text())
    entry = (skill / 'SKILL.md').read_text()
    version = re.search(r'^  version: "([^"]+)"$', entry, re.M)
    if not version or version.group(1) != plugin.get('version'):
        errors.append('Skill and plugin versions differ.')
    if plugin.get('$schema') != 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json':
        errors.append('Unexpected plugin schema identifier.')
    if plugin.get('name') != skill.name:
        errors.append('Plugin and skill names differ.')
    if plugin.get('license') != 'LicenseRef-Visual-No-Slop-1.0':
        errors.append('Unexpected plugin license identifier.')
    if (root / 'LICENSE').read_bytes() != (skill / 'LICENSE').read_bytes():
        errors.append('Installed license differs from repository license.')
    if 'DRAFT FOR REVIEW' in (root / 'LICENSE').read_text():
        errors.append('An ineffective draft is in the license path.')
    for token in ['Kirill Gotovtsev', 'https://github.com/kirillgotovtsev/visual-no-slop', 'see LICENSE']:
        if token not in entry:
            errors.append('Missing skill attribution or license reference: ' + token)
    for file in root.rglob('*'):
        if any(part in {'.git', '__pycache__', 'node_modules'}
               for part in file.relative_to(root).parts):
            continue
        if not file.is_file():
            continue
        relative = str(file.relative_to(root))
        if file.is_symlink():
            errors.append('Release contains a symlink: ' + relative)
        if file.suffix.lower() not in ['.md', '.html', '.json', '.yaml', '.yml']:
            continue
        content = file.read_text()
        if re.search(r'/Users/|/private/tmp/|/home/[^ /]+/', content):
            errors.append('Machine-specific path in ' + relative)
        if file.suffix == '.md':
            for target in re.findall(r'!?\[[^\]\n]*\]\(([^)\n]+)\)', content):
                target = target.strip('<>').split('#', 1)[0]
                if not target or re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:', target):
                    continue
                resolved = (file.parent / unquote(target)).resolve()
                checked_links += 1
                if not resolved.is_relative_to(root) or not resolved.exists():
                    errors.append(relative + ': missing or escaping target ' + target)
        if file.suffix == '.html' and re.search(r'(?:src|href)=["\']https?://', content):
            errors.append('Remote dependency in example: ' + relative)
    for case in ['print-workshop', 'project-update']:
        for name in ['before.html', 'after.html', 'before.png', 'after.png', 'brief.md']:
            if not (root / 'examples' / case / name).is_file():
                errors.append('Missing example artifact: ' + case + '/' + name)
    for name in ['before.html', 'before.png', 'brief.md', 'audit.md']:
        if not (root / 'examples' / 'justified-cards' / name).is_file():
            errors.append('Missing audit-only example artifact: ' + name)
    result = {'version': plugin.get('version'), 'relative_links_checked': checked_links,
              'errors': errors, 'passed': not errors}
    print(json.dumps(result, indent=2))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(check(Path(__file__).resolve().parents[1]))
