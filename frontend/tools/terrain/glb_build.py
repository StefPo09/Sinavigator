"""Construiește modele 3D GLB de teren (LROC NAC DTM) centrate pe un loc de aterizare.

Coordonate: x = est, y = sus, z = sud (m), originea în punctul de aterizare la nivelul solului.
Include curbura Lunii (y -= d²/2R). Două plăci: „near” (DTM 2 m, cu ortofoto) și „far” (DTM regional).

python glb_build.py <out_dir> <lat> <lon> <near_tif> <near_half_m> <near_step_m> <far_tif> <far_half_x_m> <far_half_z_m> <far_step_m> [far_ortho_tif]

Necesită în <out_dir>: ortho.json + ortho_2048.jpg + ortho_4096.jpg (placa near) și close/ortho.json +
close/ortho_1024.jpg + close/ortho_2048.jpg (placa close), produse de ortho_build.py.
Scrie: close_raw_{2048,1024}.glb, near_raw_{4096,2048}.glb, far_raw.glb, far_raw_{4096,2048}.glb, build.json.
"""
import json, math, os, struct, sys
import numpy as np
import rasterio
from rasterio.windows import Window

R = 1737400.0
out, lat0, lon0 = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
near_tif, near_half, near_step = sys.argv[4], float(sys.argv[5]), float(sys.argv[6])
far_tif, far_hx, far_hz, far_step = sys.argv[7], float(sys.argv[8]), float(sys.argv[9]), float(sys.argv[10])
far_ortho = sys.argv[11] if len(sys.argv) > 11 else None
os.makedirs(out, exist_ok=True)
cos0 = math.cos(math.radians(lat0))


def sample(tif, xr, zr, step):
    """Grilă regulată în coordonate locale; eșantionare biliniară din DTM (valori lipsă = NaN)."""
    with rasterio.open(tif) as ds:
        p = ds.crs.to_dict()
        clon, lts = float(p.get('lon_0', 0)), float(p.get('lat_ts', p.get('lat_0', 0)))
        xs = np.arange(xr[0], xr[1] + 1e-6, step)
        zs = np.arange(zr[0], zr[1] + 1e-6, step)
        X, Z = np.meshgrid(xs, zs)
        lat = lat0 - np.degrees(Z / R)
        lon = lon0 + np.degrees(X / (R * cos0))
        dlon = ((lon - clon + 540) % 360) - 180
        px = R * np.radians(dlon) * math.cos(math.radians(lts))
        py = R * np.radians(lat)
        inv = ~ds.transform
        col = inv.a * px + inv.b * py + inv.c - 0.5
        row = inv.d * px + inv.e * py + inv.f - 0.5
        c0, c1 = max(0, int(np.floor(col.min())) - 1), min(ds.width, int(np.ceil(col.max())) + 2)
        r0, r1 = max(0, int(np.floor(row.min())) - 1), min(ds.height, int(np.ceil(row.max())) + 2)
        a = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float64)
        nod = ds.nodata
        a[(~np.isfinite(a)) | (np.abs(a) > 2e4) | ((nod is not None) & (a == nod))] = np.nan
        cc, rr = col - c0, row - r0
        ci, ri = np.floor(cc).astype(int), np.floor(rr).astype(int)
        ok = (ci >= 0) & (ri >= 0) & (ci < a.shape[1] - 1) & (ri < a.shape[0] - 1)
        ci, ri = np.clip(ci, 0, a.shape[1] - 2), np.clip(ri, 0, a.shape[0] - 2)
        fx, fz = cc - ci, rr - ri
        h = (a[ri, ci] * (1 - fx) + a[ri, ci + 1] * fx) * (1 - fz) + (a[ri + 1, ci] * (1 - fx) + a[ri + 1, ci + 1] * fx) * fz
        h[~ok] = np.nan
        return xs, zs, h, ds.res[0]


def resample_image(tif, xs, zs):
    """Imaginea (uint8) eșantionată biliniar pe grila locală (xs, zs); 0 = fără date."""
    with rasterio.open(tif) as ds:
        p = ds.crs.to_dict()
        clon, lts = float(p.get('lon_0', 0)), float(p.get('lat_ts', p.get('lat_0', 0)))
        X, Z = np.meshgrid(xs, zs)
        lat = lat0 - np.degrees(Z / R)
        lon = lon0 + np.degrees(X / (R * cos0))
        dlon = ((lon - clon + 540) % 360) - 180
        px = R * np.radians(dlon) * math.cos(math.radians(lts))
        py = R * np.radians(lat)
        inv = ~ds.transform
        col = inv.a * px + inv.b * py + inv.c - 0.5
        row = inv.d * px + inv.e * py + inv.f - 0.5
        c0, c1 = max(0, int(np.floor(col.min())) - 1), min(ds.width, int(np.ceil(col.max())) + 2)
        r0, r1 = max(0, int(np.floor(row.min())) - 1), min(ds.height, int(np.ceil(row.max())) + 2)
        a = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float32)
        cc, rr = col - c0, row - r0
        ci, ri = np.clip(np.floor(cc).astype(int), 0, a.shape[1] - 2), np.clip(np.floor(rr).astype(int), 0, a.shape[0] - 2)
        ok = (cc >= 0) & (rr >= 0) & (cc < a.shape[1] - 1) & (rr < a.shape[0] - 1)
        fx, fz = np.clip(cc - ci, 0, 1), np.clip(rr - ri, 0, 1)
        v = (a[ri, ci] * (1 - fx) + a[ri, ci + 1] * fx) * (1 - fz) + (a[ri + 1, ci] * (1 - fx) + a[ri + 1, ci + 1] * fx) * fz
        v[~ok] = 0
        return v


def fill_nan(h, iters=400):
    h = h.copy()
    for _ in range(iters):
        m = np.isnan(h)
        if not m.any():
            break
        p = np.pad(h, 1, constant_values=np.nan)
        nb = np.stack([p[:-2, 1:-1], p[2:, 1:-1], p[1:-1, :-2], p[1:-1, 2:]])
        with np.errstate(all='ignore'):
            f = np.nanmean(nb, axis=0)
        h[m] = f[m]
    return h


def write_glb(path, pos, nrm, uv, idx, jpeg=None, name='terrain'):
    blobs, views, accs = [], [], []

    def add(arr, target, comp, typ, minmax=False):
        b = arr.tobytes()
        off = sum(len(x) for x in blobs)
        pad = (-len(b)) % 4
        blobs.append(b + b'\0' * pad)
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(b)}
        if target:
            v['target'] = target
        views.append(v)
        a = {'bufferView': len(views) - 1, 'componentType': comp, 'count': arr.shape[0], 'type': typ}
        if minmax:
            a['min'] = arr.min(axis=0).tolist()
            a['max'] = arr.max(axis=0).tolist()
        accs.append(a)
        return len(accs) - 1

    attrs = {'POSITION': add(pos.astype('<f4'), 34962, 5126, 'VEC3', True), 'NORMAL': add(nrm.astype('<f4'), 34962, 5126, 'VEC3')}
    if uv is not None:
        attrs['TEXCOORD_0'] = add(uv.astype('<f4'), 34962, 5126, 'VEC2')
    ii = add(idx.astype('<u4').reshape(-1), 34963, 5125, 'SCALAR')
    mat = {'name': name, 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 1, 'baseColorFactor': [1, 1, 1, 1]}}
    gl = {'asset': {'version': '2.0', 'generator': 'sinavigator glb_build.py (LROC NAC DTM)'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
          'nodes': [{'mesh': 0, 'name': name}], 'meshes': [{'name': name, 'primitives': [{'attributes': attrs, 'indices': ii, 'material': 0}]}],
          'materials': [mat], 'accessors': accs, 'bufferViews': views}
    if jpeg:
        off = sum(len(x) for x in blobs)
        pad = (-len(jpeg)) % 4
        blobs.append(jpeg + b'\0' * pad)
        views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(jpeg)})
        gl['images'] = [{'bufferView': len(views) - 1, 'mimeType': 'image/jpeg'}]
        gl['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}]
        gl['textures'] = [{'sampler': 0, 'source': 0}]
        mat['pbrMetallicRoughness']['baseColorTexture'] = {'index': 0}
    binb = b''.join(blobs)
    gl['buffers'] = [{'byteLength': len(binb)}]
    js = json.dumps(gl, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binb)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A) + js)
        f.write(struct.pack('<II', len(binb), 0x004E4942) + binb)


def grid_mesh(xs, zs, h, keep=None):
    ny, nx = h.shape
    X, Z = np.meshgrid(xs, zs)
    y = h - (X ** 2 + Z ** 2) / (2 * R)  # curbura Lunii
    pos = np.stack([X, y, Z], -1).reshape(-1, 3)
    # normale din gradient
    dzdx = np.gradient(y, xs, axis=1)
    dzdz = np.gradient(y, zs, axis=0)
    n = np.stack([-dzdx, np.ones_like(y), -dzdz], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    a = (np.arange(ny - 1)[:, None] * nx + np.arange(nx - 1)[None, :])
    quads = np.stack([a, a + nx, a + 1, a + 1, a + nx, a + nx + 1], -1)
    if keep is not None:
        quads = quads[keep]
    idx = quads.reshape(-1, 3)
    return pos, n.reshape(-1, 3), idx


# ── placa apropiată (DTM 2 m), limitată la zona cu ortofoto valid ──
from PIL import Image
o = json.load(open(os.path.join(out, 'ortho.json')))
im = np.asarray(Image.open(os.path.join(out, 'ortho_2048.jpg')).convert('L'), dtype=np.float32)
cols = np.where(im.std(axis=0) > 4)[0]
rows = np.where(im.std(axis=1) > 4)[0]
mx = (o['x1'] - o['x0']) / im.shape[1]
mz = (o['z1'] - o['z0']) / im.shape[0]
vx = (o['x0'] + cols[0] * mx + 30, o['x0'] + (cols[-1] + 1) * mx - 30)
vz = (o['z0'] + rows[0] * mz + 30, o['z0'] + (rows[-1] + 1) * mz - 30)
nxr = (max(-near_half, vx[0]), min(near_half, vx[1]))
nzr = (max(-near_half, vz[0]), min(near_half, vz[1]))
nxr = (np.floor(nxr[0] / near_step) * near_step + near_step, np.floor(nxr[1] / near_step) * near_step)
nzr = (np.floor(nzr[0] / near_step) * near_step + near_step, np.floor(nzr[1] / near_step) * near_step)
xs, zs, hn, nres = sample(near_tif, nxr, nzr, near_step)
miss = np.isnan(hn).mean()
hn = fill_nan(hn)
x_mid, z_mid = int(np.argmin(np.abs(xs))), int(np.argmin(np.abs(zs)))
site_h = float(hn[z_mid, x_mid])
hn -= site_h

# ── placa de aproape (~1 km): ortofoto NAC la rezoluție nativă, relief DTM la 1 m (interpolat) ──
oc = json.load(open(os.path.join(out, 'close', 'ortho.json')))
CS = 1.0
cxr = (np.ceil((oc['x0'] + 12) / CS) * CS, np.floor((oc['x1'] - 12) / CS) * CS)
czr = (np.ceil((oc['z0'] + 12) / CS) * CS, np.floor((oc['z1'] - 12) / CS) * CS)
xc, zc, hc, _ = sample(near_tif, cxr, czr, CS)
hc = fill_nan(hc) - site_h
cpos, cnrm, cidx = grid_mesh(xc, zc, hc)
cuv = np.stack([(cpos[:, 0] - oc['x0']) / (oc['x1'] - oc['x0']), (cpos[:, 2] - oc['z0']) / (oc['z1'] - oc['z0'])], -1)
for size in (2048, 1024):
    write_glb(os.path.join(out, f'close_raw_{size}.glb'), cpos, cnrm, cuv, cidx, open(os.path.join(out, 'close', f'ortho_{size}.jpg'), 'rb').read(), 'close')
print(f'close: {len(xc)}x{len(zc)} grid, step {CS} m, ortho {oc["resolution_m"]:.2f} m/px', flush=True)

def in_close(X, Z, m):
    return (X > cxr[0] + m) & (X < cxr[1] - m) & (Z > czr[0] + m) & (Z < czr[1] - m)
XN, ZN = np.meshgrid(xs, zs)
hn_mesh = hn.copy()
hn_mesh[in_close(XN, ZN, 1)] -= 0.4  # sub placa de aproape
nkeep = ~(in_close(XN[:-1, :-1], ZN[:-1, :-1], 2 * near_step) & in_close(XN[1:, 1:], ZN[1:, 1:], 2 * near_step))
pos, nrm, idx = grid_mesh(xs, zs, hn_mesh, keep=nkeep)
uv = np.stack([(pos[:, 0] - o['x0']) / (o['x1'] - o['x0']), (pos[:, 2] - o['z0']) / (o['z1'] - o['z0'])], -1)
for size in (4096, 2048):
    jpg = open(os.path.join(out, f'ortho_{size}.jpg'), 'rb').read()
    write_glb(os.path.join(out, f'near_raw_{size}.glb'), pos, nrm, uv, idx, jpg, 'near')
print(f'near: {len(xs)}x{len(zs)} grid, step {near_step} m (DTM {nres} m), missing {miss:.1%}, relief {np.nanmax(hn) - np.nanmin(hn):.0f} m', flush=True)

# ── placa regională (DTM 5 m), cu gol unde există placa apropiată ──
xf, zf, hf, fres = sample(far_tif, (-far_hx, far_hx), (-far_hz, far_hz), far_step)
valid_cols = ~np.all(np.isnan(hf), axis=0)
valid_rows = ~np.all(np.isnan(hf), axis=1)
xf, zf, hf = xf[valid_cols], zf[valid_rows], hf[np.ix_(valid_rows, valid_cols)]
fmiss = np.isnan(hf).mean()
fnan = np.isnan(hf)
hf = fill_nan(hf)  # doar pentru normale; triunghiurile fără date reale se elimină mai jos
# alinierea verticală a DTM-ului regional cu cel apropiat (pot avea referințe ușor diferite)
X, Z = np.meshgrid(xf, zf)
def in_near(X, Z, m):
    return (X > nxr[0] + m) & (X < nxr[1] - m) & (Z > nzr[0] + m) & (Z < nzr[1] - m)
inner = in_near(X, Z, 50)
xi = np.clip(np.searchsorted(xs, X[inner]), 0, len(xs) - 1)
zi = np.clip(np.searchsorted(zs, Z[inner]), 0, len(zs) - 1)
offset = float(np.median(hn[zi, xi] - (hf[inner] - site_h)))
hf = hf - site_h + offset
hf[inner] -= 3.0  # sub placa apropiată, ca să nu se suprapună vizual
hole = in_near(X[:-1, :-1], Z[:-1, :-1], 2 * far_step) & in_near(X[1:, 1:], Z[1:, 1:], 2 * far_step)
nodata = fnan[:-1, :-1] | fnan[1:, :-1] | fnan[:-1, 1:] | fnan[1:, 1:]
pos, nrm, idx = grid_mesh(xf, zf, hf, keep=~hole & ~nodata)
write_glb(os.path.join(out, 'far_raw.glb'), pos, nrm, None, idx, None, 'far')
if far_ortho:
    # imaginea NAC regională, reproiectată pe grila locală a plăcii regionale
    from PIL import Image
    W = 4096
    Hh = int(round(W * (zf[-1] - zf[0]) / (xf[-1] - xf[0])))
    if Hh > 4096:
        Hh, W = 4096, int(round(4096 * (xf[-1] - xf[0]) / (zf[-1] - zf[0])))
    tx = np.linspace(xf[0], xf[-1], W)
    tz = np.linspace(zf[0], zf[-1], Hh)
    img = resample_image(far_ortho, tx, tz)
    valid = img > 0
    lo, hi = np.percentile(img[valid], [0.3, 99.7])
    im = np.clip((img - lo) / max(1, hi - lo), 0, 1) ** 0.9 * 245 + 6
    im[~valid] = np.median(im[valid])
    full = Image.fromarray(im.astype(np.uint8), 'L')
    import io
    fuv = np.stack([(pos[:, 0] - xf[0]) / (xf[-1] - xf[0]), (pos[:, 2] - zf[0]) / (zf[-1] - zf[0])], -1)
    for size in (4096, 2048):
        k = size / max(full.size)
        b = io.BytesIO()
        full.resize((max(1, round(full.size[0] * k)), max(1, round(full.size[1] * k))), Image.LANCZOS).save(b, 'JPEG', quality=86, optimize=True)
        write_glb(os.path.join(out, f'far_raw_{size}.glb'), pos, nrm, fuv, idx, b.getvalue(), 'far')
    print(f'far ortho: {W}x{Hh} px, {(xf[-1] - xf[0]) / W:.1f} m/px, coverage {valid.mean():.0%}', flush=True)
print(f'far: {len(xf)}x{len(zf)} grid, step {far_step} m (DTM {fres} m), missing {fmiss:.1%}, offset {offset:.1f} m, relief {hf.max() - hf.min():.0f} m', flush=True)

json.dump({'lat': lat0, 'lon': lon0, 'site_h_m': site_h, 'curvature': True,
           'close': {'step_m': CS, 'x': [float(xc[0]), float(xc[-1])], 'z': [float(zc[0]), float(zc[-1])], 'ortho': oc},
           'near': {'tif': os.path.basename(near_tif), 'dtm_res_m': nres, 'step_m': near_step, 'half_m': near_half, 'x': [float(xs[0]), float(xs[-1])], 'z': [float(zs[0]), float(zs[-1])], 'ortho': o},
           'far': {'tif': os.path.basename(far_tif), 'dtm_res_m': fres, 'step_m': far_step, 'x': [float(xf[0]), float(xf[-1])], 'z': [float(zf[0]), float(zf[-1])], 'offset_m': offset, 'ortho': os.path.basename(far_ortho).replace('.TIF', '') if far_ortho else None}},
          open(os.path.join(out, 'build.json'), 'w'), indent=1)
print('ok', flush=True)
