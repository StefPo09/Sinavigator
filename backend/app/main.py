import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .bundles import BundleError, load_bundle
from .settings import CONFIG_PATH, SITES_PATH, get_bundle_path

app = FastAPI(
    title="Sinavigator API",
    description="Serves the generated scientific data bundle consumed by the Sinavigator frontend.",
    version="1.0.0",
)


def _read_json(path: Path, label: str) -> Any:
    try:
        with path.open(encoding="utf-8") as json_file:
            return json.load(json_file)
    except (OSError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=500, detail=f"Unable to read {label}: {error}") from error


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def readiness() -> dict[str, str]:
    try:
        bundle = load_bundle(get_bundle_path())
    except BundleError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return {"status": "ready", "generatedAt": bundle["generatedAt"]}


@app.get("/api/v1/bundle")
def get_bundle() -> JSONResponse:
    try:
        bundle = load_bundle(get_bundle_path())
    except BundleError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return JSONResponse(bundle, headers={"Cache-Control": "no-store"})


@app.get("/api/v1/sites")
def get_sites() -> dict[str, Any]:
    sites = _read_json(SITES_PATH, "site catalog")
    return {"sites": sites["sites"]}


@app.get("/api/v1/config")
def get_config() -> dict[str, Any]:
    return _read_json(CONFIG_PATH, "study configuration")
