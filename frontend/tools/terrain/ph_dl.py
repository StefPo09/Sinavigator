"""Descarcă modele/texturi Poly Haven (CC0) prin API-ul public.
python ph_dl.py <out_dir> model:<id>:<res> ... texture:<id>:<res>:<maps,..>
"""
import json, os, sys, urllib.request

UA = {'User-Agent': 'sinavigator-build'}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


out = sys.argv[1]
for spec in sys.argv[2:]:
    kind, aid, res, *rest = spec.split(':')
    files = json.loads(get(f'https://api.polyhaven.com/files/{aid}'))
    d = os.path.join(out, aid)
    os.makedirs(d, exist_ok=True)
    if kind == 'model':
        g = files['gltf'][res]['gltf']
        open(os.path.join(d, os.path.basename(g['url'])), 'wb').write(get(g['url']))
        for rel, info in g.get('include', {}).items():
            p = os.path.join(d, rel)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(get(info['url']))
    else:
        for m in rest[0].split(','):
            info = files[m][res]['jpg']
            open(os.path.join(d, os.path.basename(info['url'])), 'wb').write(get(info['url']))
    print('ok', aid, flush=True)
