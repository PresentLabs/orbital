#!/usr/bin/env python3
"""Build the WordPress installer from the module's reviewed source (no test fixtures)."""
from pathlib import Path
import hashlib, json, re, zipfile
module = Path(__file__).resolve().parent
root = module.parents[1]
source = module / 'wordpress' / 'woo-dte-chile'
version = re.search(r'\* Version: ([0-9.]+)', (source / 'woo-dte-chile.php').read_text()).group(1)
out = root / 'public' / 'modules' / f'woo-dte-chile-{version}.zip'
out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(source.rglob('*')):
        relative = path.relative_to(source)
        if path.is_file() and relative.parts[0] != 'tests' and path.name != '.DS_Store':
            archive.write(path, Path('woo-dte-chile') / relative)
with zipfile.ZipFile(out) as archive:
    assert archive.testzip() is None
    assert all(name.startswith('woo-dte-chile/') and '..' not in Path(name).parts for name in archive.namelist())
digest = hashlib.sha256(out.read_bytes()).hexdigest()
(module / 'SHA256SUMS').write_text(f'{digest}  public/modules/{out.name}\n')
(module / 'manifest.json').write_text(json.dumps({'id':'woo-dte-chile','version':version,'wordpressInstaller':f'/modules/{out.name}','sha256':digest,'requires':['astro','payload','woocommerce'],'dte':[33,39,56,61],'environments':['certification','production'],'siiCertificationVerified':False},indent=2)+'\n')
print(f'{out.name}: ZIP OK, sha256 {digest}')
