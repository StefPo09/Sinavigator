import math, sys, rasterio
from rasterio.env import Env
R = 1737400.0
BASE = 'https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001'
lat, lon = float(sys.argv[1]), float(sys.argv[2])
for rel in sys.argv[3:]:
    with Env(GDAL_HTTP_USERAGENT='Mozilla/5.0', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.TIF', GDAL_HTTP_MAX_RETRY='20', GDAL_HTTP_RETRY_DELAY='3', GDAL_HTTP_RETRY_CODES='429,503'):
        try:
            with rasterio.open('/vsicurl/' + BASE + '/' + rel) as ds:
                p = ds.crs.to_dict()
                clon, lts = float(p.get('lon_0', 0)), float(p.get('lat_ts', p.get('lat_0', 0)))
                dlon = ((lon - clon + 540) % 360) - 180
                x, y = R * math.radians(dlon) * math.cos(math.radians(lts)), R * math.radians(lat)
                c, r = ~ds.transform * (x, y)
                inside = 0 <= c < ds.width and 0 <= r < ds.height
                print(rel.rsplit('/', 1)[1], f'{ds.width}x{ds.height} res {ds.res[0]:.2f} {ds.dtypes[0]} tiled={ds.profile.get("tiled")}',
                      f'site col {c:.0f} row {r:.0f} inside={inside}', f'extent {ds.width * ds.res[0] / 1000:.1f}x{ds.height * ds.res[1] / 1000:.1f} km')
        except Exception as e:
            print('ERR', rel, e)
