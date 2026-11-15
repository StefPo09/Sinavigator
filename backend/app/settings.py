import os
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = Path(__file__).resolve().parents[1] / "config.json"
SITES_PATH = Path(__file__).resolve().parents[1] / "sites.json"


def get_bundle_path() -> Path:
    configured = os.environ.get("SINAVIGATOR_BUNDLE_PATH")
    if configured:
        path = Path(configured).expanduser()
        return path if path.is_absolute() else REPOSITORY_ROOT / path
    return REPOSITORY_ROOT / "frontend" / "public" / "data" / "bundle.json"
