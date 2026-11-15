import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from backend.app.bundles import BundleError, load_bundle, validate_bundle
from backend.app.main import get_bundle, get_config, get_sites, health, readiness
from backend.app.settings import get_bundle_path
from fastapi import HTTPException


class BundleValidationTests(unittest.TestCase):
    def test_current_frontend_bundle_matches_backend_contract(self) -> None:
        bundle = load_bundle(get_bundle_path())
        self.assertEqual(bundle["provenance"], "computed")
        self.assertEqual({site["id"] for site in bundle["sites"]}, {"apollo15", "apollo17"})
        self.assertEqual(len(bundle["scenarios"]), 6)

    def test_rejects_non_object_bundle(self) -> None:
        with self.assertRaisesRegex(BundleError, "root must be a JSON object"):
            validate_bundle([])

    def test_rejects_incorrect_sample_count(self) -> None:
        bundle = load_bundle(get_bundle_path())
        bundle["scenarios"][0]["sun"]["azDeg"].pop()
        with self.assertRaisesRegex(BundleError, "must contain 433 samples"):
            validate_bundle(bundle)

    def test_missing_bundle_has_actionable_error(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "missing.json"
            with self.assertRaisesRegex(BundleError, "Run the documented bundle generator"):
                load_bundle(path)

    def test_invalid_json_is_not_replaced_by_synthetic_data(self) -> None:
        with TemporaryDirectory() as directory:
            path = Path(directory) / "broken.json"
            path.write_text("{", encoding="utf-8")
            with self.assertRaisesRegex(BundleError, "Unable to read data bundle"):
                load_bundle(path)

    def test_api_exposes_current_bundle_and_metadata(self) -> None:
        with patch("backend.app.main.get_bundle_path", return_value=get_bundle_path()):
            response = get_bundle()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(json.loads(response.body)["provenance"], "computed")
            self.assertEqual(readiness()["status"], "ready")
        self.assertEqual(health(), {"status": "ok"})
        self.assertEqual(len(get_sites()["sites"]), 2)
        self.assertEqual(get_config()["scenario_duration_hours"], 72)

    def test_api_reports_missing_bundle_as_not_ready(self) -> None:
        with TemporaryDirectory() as directory:
            missing = Path(directory) / "missing.json"
            with patch("backend.app.main.get_bundle_path", return_value=missing):
                with self.assertRaises(HTTPException) as error:
                    get_bundle()
                self.assertEqual(error.exception.status_code, 503)
                with self.assertRaises(HTTPException) as error:
                    readiness()
                self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
