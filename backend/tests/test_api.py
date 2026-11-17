"""
DataForge AI - Comprehensive Automated Verification Suite
Tests all 9 core capabilities:
1. Ingestion of CSV and Excel
2. Data profiling
3. Missing-value and duplicate detection
4. Reversible non-code data cleaning
5. Business analytics & statistical summaries
6. Statistical + ML Anomaly Detection (Isolation Forest)
7. Trend predictions and evidence insights
8. Interactive visualization recommendations
9. AI App Studio workbook analysis & blueprinting
"""

import sys
import os
import unittest
import pandas as pd

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.engine.data_store import store
from app.engine.profiler import profile_dataset
from app.engine.cleaner import CleaningRule, apply_transformation_pipeline
from app.engine.anomaly import detect_comprehensive_anomalies
from app.engine.business_rules import BusinessRule, ApprovedException, evaluate_business_rules
from app.engine.visualizer import recommend_visualizations
from app.engine.predictor import generate_predictions_and_insights
from app.studio.analyzer import analyze_workbook
from app.studio.templates import get_builtin_templates

class TestDataForgeAI(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Resolve sample files relative to repository root
        cls.repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        cls.csv_path = os.path.join(cls.repo_root, "sample_data", "manufacturing_operations.csv")
        cls.xlsx_path = os.path.join(cls.repo_root, "sample_data", "supply_chain_multi_sheet.xlsx")

    def test_01_csv_ingestion_and_profiling(self):
        """Test CSV file ingestion and automatic profiling."""
        with open(self.csv_path, "rb") as f:
            content = f.read()
        
        result = store.load_file(content, "manufacturing_operations.csv")
        self.assertIn("dataset_id", result)
        self.assertIn("profile", result)
        
        profile = result["profile"]
        self.assertEqual(profile["total_rows"], 500)
        self.assertGreaterEqual(profile["total_cols"], 7)
        self.assertIn("domain", profile)

    def test_02_excel_multi_sheet_ingestion(self):
        """Test multi-sheet Excel ingestion and worksheet switching."""
        with open(self.xlsx_path, "rb") as f:
            content = f.read()
        
        result = store.load_file(content, "supply_chain_multi_sheet.xlsx")
        ds_id = result["dataset_id"]
        sheets = result["sheets"]
        self.assertGreaterEqual(len(sheets), 2)
        self.assertIn("Shipments", sheets)
        
        # Test switching sheet
        switched = store.switch_sheet(ds_id, sheets[1])
        self.assertIsNotNone(switched)

    def test_03_data_cleaning_pipeline(self):
        """Test reversible non-code data cleaning pipeline."""
        df = pd.DataFrame({
            "val": [10.0, 20.0, None, 20.0],
            "text": ["A", "B", "C", "B"]
        })
        
        # Apply drop duplicates and handle missing by fill mean
        rules = [
            CleaningRule(action="drop_duplicates"),
            CleaningRule(action="handle_missing", column="val", strategy="mean")
        ]
        cleaned = apply_transformation_pipeline(df, rules)
        self.assertEqual(len(cleaned), 3)
        self.assertFalse(cleaned["val"].isnull().any())

    def test_04_anomaly_detection_ml(self):
        """Test Isolation Forest ML + statistical IQR/Z-score anomaly detection."""
        with open(self.csv_path, "rb") as f:
            content = f.read()
        res = store.load_file(content, "manufacturing_operations.csv")
        ds_id = res["dataset_id"]
        df = store.active_dataframes[ds_id]
        
        anom_res = detect_comprehensive_anomalies(df, sheet_name="Default")
        self.assertIn("anomalies", anom_res)
        self.assertIn("summary", anom_res)
        self.assertTrue(anom_res["ml_engine_active"])
        self.assertGreater(anom_res["summary"]["total_anomalies"], 0)

    def test_05_business_rules_and_exceptions(self):
        """Test business rules engine and approved exceptions."""
        df = pd.DataFrame({
            "Record_ID": ["REC-1", "REC-2", "REC-3"],
            "cost": [500.0, 1500.0, 200.0]
        })
        # Rule triggers when cost > 1000 (meaning REC-2 is a violation)
        rules = [
            BusinessRule(
                id="r1",
                name="Cost Ceiling Breach",
                column="cost",
                operator=">",
                threshold=1000.0,
                severity="High",
                explanation="Cost exceeded maximum policy limit of 1000"
            )
        ]
        # REC-2 has an approved exception
        exceptions = [
            ApprovedException(
                id="ex1",
                rule_id="r1",
                record_id="REC-2",
                owner="Finance Director",
                reason="Management approved rush order",
                created_at="2026-11-01"
            )
        ]
        eval_res = evaluate_business_rules(df, rules, exceptions)
        self.assertEqual(eval_res["total_violations"], 1)
        self.assertEqual(eval_res["approved_exceptions"], 1)
        self.assertEqual(eval_res["active_breaches"], 0)

    def test_06_visualization_recommendations(self):
        """Test automatic chart recommendation engine."""
        with open(self.csv_path, "rb") as f:
            content = f.read()
        res = store.load_file(content, "manufacturing_operations.csv")
        ds_id = res["dataset_id"]
        df = store.active_dataframes[ds_id]
        
        charts = recommend_visualizations(df)
        self.assertIsInstance(charts, list)
        self.assertGreater(len(charts), 0)

    def test_07_predictions_and_insights(self):
        """Test deterministic trend forecasting and evidence insights."""
        with open(self.csv_path, "rb") as f:
            content = f.read()
        res = store.load_file(content, "manufacturing_operations.csv")
        ds_id = res["dataset_id"]
        df = store.active_dataframes[ds_id]
        
        pred_res = generate_predictions_and_insights(df)
        self.assertIn("insights", pred_res)
        self.assertIsInstance(pred_res["insights"], list)

    def test_08_studio_analyzer_and_templates(self):
        """Test AI App Studio workbook analysis and instant templates."""
        with open(self.xlsx_path, "rb") as f:
            content = f.read()
        report = analyze_workbook(content, "supply_chain_multi_sheet.xlsx")
        self.assertIn("sheets", report)
        self.assertIn("relationships", report)
        
        templates = get_builtin_templates()
        self.assertGreater(len(templates), 0)


if __name__ == "__main__":
    unittest.main()
