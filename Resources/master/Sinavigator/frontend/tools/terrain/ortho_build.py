"""Fereastra de ortofoto NAC în jurul unui loc, la rezoluție nativă, salvată ca JPEG în mai multe mărimi.
python ortho_build.py <out_dir> <lat> <lon> <half_m> <url_rel> <sizes...>
"""
import json, math, os, sys, time
import numpy as np
import rasterio
from rasterio.env import Env
from rasterio.windows import Window
from PIL import Image

R = 1737400.0
BASE = 'https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/'
out, lat, lon, half, rel = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
sizes = [int(s) for s in sys.argv[6:]]
os.makedirs(out, exist_ok=True)
env = dict(GDAL_HTTP_USERAGENT='Mozilla/5.0', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.TIF',
           GDAL_HTTP_MAX_RETRY='40', GDAL_HTTP_RETRY_DELAY='5', GDAL_HTTP_RETRY_CODES='429,500,502,503,504',
           GDAL_HTTP_MULTIRANGE='YES', GDAL_HTTP_MERGE_CONSECUTIVE_RANGES='YES', CPL_VSIL_CURL_CHUNK_SIZE='2097152', VSI_CACHE='TRUE', VSI_CACHE_SIZE='500000000')
t0 = time.time()
with Env(**env), rasterio.open('/vsicurl/' + BASE + rel) as ds:
    p = ds.crs.to_dict()
    clon, lts = float(p.get('lon_0', 0)), float(p.get('lat_ts', p.get('lat_0', 0)))
    dlon = ((lon - clon + 540) % 360) - 180
    x, y = R * math.radians(dlon) * math.cos(math.radians(lts)), R * math.radians(lat)
    col, row = ~ds.transform * (x, y)
    res = ds.res[0]
    h = half / res
    c0, c1 = max(0, int(col - h)), min(ds.width, int(col + h))
    r0, r1 = max(0, int(row - h)), min(ds.height, int(row + h))
    img = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0))
    print(f'read {img.shape} in {time.time() - t0:.0f}s', flush=True)
    valid = img > 0
    lo, hi = np.percentile(img[valid], [0.3, 99.7])
    f = np.clip((img.astype(np.float32) - lo) / max(1, hi - lo), 0, 1)
    f = f ** 0.9  # ușoară ridicare a tonurilor medii
    im = (f * 245 + 6).astype(np.uint8)
    im[~valid] = int(np.median(im[valid]))
    full = Image.fromarray(im, 'L')
    # extinderea ferestrei în metri, relativ la locul de aterizare (x = est, z = sud)
    meta = {'product': rel.rsplit('/', 1)[1].replace('.PYR.TIF', ''), 'url': BASE + rel, 'resolution_m': res,
            'x0': (c0 - col) * res, 'x1': (c1 - col) * res, 'z0': (r0 - row) * res, 'z1': (r1 - row) * res, 'native_px': list(img.shape[::-1])}
    for s in sizes:
        k = s / max(full.size)
        full.resize((max(1, round(full.size[0] * k)), max(1, round(full.size[1] * k))), Image.LANCZOS).save(os.path.join(out, f'ortho_{s}.jpg'), quality=88, optimize=True)
    json.dump(meta, open(os.path.join(out, 'ortho.json'), 'w'), indent=1)
    print('done', meta, f'{time.time() - t0:.0f}s', flush=True)
