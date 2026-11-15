import json, struct, sys
p = sys.argv[1]
with open(p, 'rb') as f:
    magic, ver, length = struct.unpack('<III', f.read(12))
    clen, ctype = struct.unpack('<II', f.read(8))
    js = json.loads(f.read(clen))
print('magic', hex(magic), 'ver', ver, 'len', length)
print('asset', js.get('asset'))
print('extensionsUsed', js.get('extensionsUsed'), 'required', js.get('extensionsRequired'))
print('scenes', js.get('scenes'))
for i, n in enumerate(js.get('nodes', [])):
    print('node', i, {k: v for k, v in n.items() if k != 'extras'})
for i, m in enumerate(js.get('meshes', [])):
    print('mesh', i, m.get('name'), [{k: v for k, v in pr.items()} for pr in m['primitives']])
for i, a in enumerate(js.get('accessors', [])):
    print('acc', i, a.get('type'), a.get('componentType'), a.get('count'), a.get('min'), a.get('max'))
print('materials', json.dumps(js.get('materials'))[:800])
print('textures', js.get('textures'))
print('images', [{k: v for k, v in im.items()} for im in js.get('images', [])])
for i, bv in enumerate(js.get('bufferViews', [])):
    print('bv', i, bv.get('byteLength'))
print('samplers', js.get('samplers'))
