import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any


class BundleError(Exception):
    """Raised when the generated frontend bundle is unavailable or invalid."""


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise BundleError(message)


def validate_bundle(value: Any) -> dict[str, Any]:
    _require(isinstance(value, dict), "Bundle root must be a JSON object.")
    _require(value.get("provenance") in {"fixture", "computed"}, "Bundle provenance must be fixture or computed.")
    generated_at = value.get("generatedAt")
    _require(isinstance(generated_at, str), "Bundle generatedAt must be an ISO timestamp.")
    try:
        datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise BundleError("Bundle generatedAt must be an ISO timestamp.") from error

    rules = value.get("rules")
    _require(isinstance(rules, dict), "Bundle rules must be an object.")
    for key in ("sunMarginDeg", "earthMarginDeg"):
        _require(_is_number(rules.get(key)), f"Bundle rules.{key} must be a finite number.")

    sites = value.get("sites")
    _require(isinstance(sites, list) and sites, "Bundle sites must be a non-empty array.")
    site_ids: set[str] = set()
    for index, site in enumerate(sites):
        _require(isinstance(site, dict), f"Bundle sites[{index}] must be an object.")
        site_id = site.get("id")
        _require(isinstance(site_id, str) and site_id, f"Bundle sites[{index}] needs an id.")
        _require(site_id not in site_ids, f"Bundle has duplicate site id {site_id!r}.")
        site_ids.add(site_id)
        for key in ("latDeg", "lonDeg", "observerHeightM"):
            _require(_is_number(site.get(key)), f"Site {site_id!r} field {key} must be a finite number.")
        _require(abs(site["latDeg"]) <= 90, f"Site {site_id!r} latitude is outside ±90 degrees.")
        _require(isinstance(site.get("name"), str) and isinstance(site.get("short"), str),
                 f"Site {site_id!r} needs name and short labels.")

    profiles = value.get("profiles")
    _require(isinstance(profiles, list), "Bundle profiles must be an array.")
    profile_ids: set[str] = set()
    for index, profile in enumerate(profiles):
        _require(isinstance(profile, dict), f"Bundle profiles[{index}] must be an object.")
        site_id = profile.get("siteId")
        _require(isinstance(site_id, str), f"Bundle profiles[{index}] needs a siteId.")
        _require(site_id in site_ids, f"Profile {index} refers to unknown site {site_id!r}.")
        _require(site_id not in profile_ids, f"Bundle has duplicate profile for site {site_id!r}.")
        profile_ids.add(site_id)
        step = profile.get("stepDeg")
        _require(_is_number(step) and step > 0, f"Profile {site_id!r} stepDeg must be positive.")
        count = round(360 / step)
        _require(abs(count * step - 360) < 1e-6, f"Profile {site_id!r} stepDeg must divide 360.")
        elevations = profile.get("elevDeg")
        _require(isinstance(elevations, list) and len(elevations) == count,
                 f"Profile {site_id!r} must contain {count} horizon samples.")
        for sample in elevations:
            _require(sample is None or (_is_number(sample) and abs(sample) <= 90),
                     f"Profile {site_id!r} has a horizon sample outside ±90 degrees.")

    scenarios = value.get("scenarios")
    _require(isinstance(scenarios, list) and scenarios, "Bundle scenarios must be a non-empty array.")
    scenario_ids: set[str] = set()
    site_starts: set[tuple[str, str]] = set()
    for index, scenario in enumerate(scenarios):
        _require(isinstance(scenario, dict), f"Bundle scenarios[{index}] must be an object.")
        scenario_id = scenario.get("id")
        site_id = scenario.get("siteId")
        _require(isinstance(scenario_id, str) and scenario_id, f"Bundle scenarios[{index}] needs an id.")
        _require(scenario_id not in scenario_ids, f"Bundle has duplicate scenario id {scenario_id!r}.")
        scenario_ids.add(scenario_id)
        _require(isinstance(site_id, str), f"Scenario {scenario_id!r} needs a siteId.")
        _require(site_id in site_ids, f"Scenario {scenario_id!r} refers to unknown site {site_id!r}.")
        start = scenario.get("startUtc")
        _require(isinstance(start, str), f"Scenario {scenario_id!r} startUtc must be an ISO timestamp.")
        try:
            datetime.fromisoformat(start.replace("Z", "+00:00"))
        except ValueError as error:
            raise BundleError(f"Scenario {scenario_id!r} startUtc must be an ISO timestamp.") from error
        site_start = (site_id, start)
        _require(site_start not in site_starts, f"Scenario {scenario_id!r} duplicates a site/start pair.")
        site_starts.add(site_start)
        duration = scenario.get("durationH")
        step_min = scenario.get("stepMin")
        _require(_is_number(duration) and duration > 0, f"Scenario {scenario_id!r} durationH must be positive.")
        _require(_is_number(step_min) and step_min > 0, f"Scenario {scenario_id!r} stepMin must be positive.")
        sample_count = duration * 60 / step_min + 1
        _require(abs(sample_count - round(sample_count)) < 1e-6,
                 f"Scenario {scenario_id!r} duration must be a whole number of steps.")
        expected = round(sample_count)
        for body in ("sun", "earth"):
            series = scenario.get(body)
            _require(isinstance(series, dict), f"Scenario {scenario_id!r} is missing {body} series.")
            azimuths = series.get("azDeg")
            elevations = series.get("elDeg")
            _require(isinstance(azimuths, list) and len(azimuths) == expected,
                     f"Scenario {scenario_id!r} {body} azDeg must contain {expected} samples.")
            _require(isinstance(elevations, list) and len(elevations) == expected,
                     f"Scenario {scenario_id!r} {body} elDeg must contain {expected} samples.")
            _require(all(_is_number(sample) for sample in azimuths),
                     f"Scenario {scenario_id!r} {body} azimuths must be finite numbers.")
            _require(all(sample is None or (_is_number(sample) and abs(sample) <= 90) for sample in elevations),
                     f"Scenario {scenario_id!r} {body} elevations must be within ±90 degrees or null.")

    return value


def load_bundle(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as bundle_file:
            raw = json.load(bundle_file)
    except FileNotFoundError as error:
        raise BundleError(f"Computed data bundle not found at {path}. Run the documented bundle generator first.") from error
    except (OSError, json.JSONDecodeError) as error:
        raise BundleError(f"Unable to read data bundle at {path}: {error}") from error
    return validate_bundle(raw)
