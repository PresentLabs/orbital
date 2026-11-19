#!/usr/bin/env python3
"""Verify every inventoried source byte. This does not assert functional equivalence."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import zipfile


def audit(archive, inventory):
    source = Path(archive).read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    errors = []
    verified = 0
    expected = {(row['package'], row['path']): row for row in inventory['files']}
    found = set()
    with zipfile.ZipFile(io.BytesIO(source)) as outer:
        for package in inventory['packages']:
            with zipfile.ZipFile(io.BytesIO(outer.read(package['archive']))) as inner:
                for item in inner.infolist():
                    parts = Path(item.filename).parts
                    if item.is_dir() or '__MACOSX' in parts or Path(item.filename).name == '.DS_Store':
                        continue
                    key = (package['archive'], item.filename)
                    found.add(key)
                    row = expected.get(key)
                    if row is None:
                        errors.append({'package': key[0], 'path': key[1], 'error': 'No inventariado'})
                        continue
                    content = inner.read(item)
                    if len(content) != row['bytes'] or hashlib.sha256(content).hexdigest() != row['sha256']:
                        errors.append({'package': key[0], 'path': key[1], 'error': 'Contenido diferente'})
                    else:
                        verified += 1
    errors += [{'package': package, 'path': path, 'error': 'Ausente del ZIP'} for package, path in sorted(expected.keys() - found)]
    unresolved = [{'feature': feature['id'], **ref} for feature in inventory['features'] for ref in feature['sources']
                  if not any(package == ref['package'] and (path == ref['path'] or (ref['path'].endswith('/') and path.startswith(ref['path']))) for package, path in expected)]
    return {'archiveSha256': digest, 'archiveMatchesInventory': digest == inventory['archiveSha256'],
            'packages': len(inventory['packages']), 'features': len(inventory['features']),
            'inventoriedFiles': len(expected), 'verifiedFiles': verified, 'errors': errors,
            'unresolvedFeatureReferences': unresolved,
            'filesWithFeatureReferences': sum(bool(row['featureReferences']) for row in expected.values()),
            'functionalParityVerified': False,
            'note': 'Integridad documental y binaria; la paridad funcional requiere implementación y pruebas por bloque.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--inventory', default='docs/INVENTARIO-MODULO-RESERVAS.json')
    parser.add_argument('--output')
    args = parser.parse_args()
    result = audit(args.archive, json.loads(Path(args.inventory).read_text()))
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(encoded)
    print(encoded)
    raise SystemExit(0 if result['archiveMatchesInventory'] and not result['errors'] else 1)
