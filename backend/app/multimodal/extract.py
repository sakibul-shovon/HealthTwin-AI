import os
import json
from typing import Dict, Any

def _load_synonyms() -> dict:
    try:
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
        with open(os.path.join(data_dir, "drug_synonyms.json"), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

DRUG_SYNONYMS = _load_synonyms()

def _normalize_drug(name: str) -> str:
    lower_name = name.lower().strip()
    for canonical, synonyms in DRUG_SYNONYMS.items():
        if lower_name == canonical.lower():
            return canonical
        if lower_name in [s.lower() for s in synonyms]:
            return canonical
    return name

def extract(file_bytes: bytes, filename: str, kind: str) -> Dict[str, Any]:
    """
    Extract structured entities from a document file.
    Uses a mock/deterministic approach for demo and tests to avoid OCR/vision LLM dependencies.
    """
    name_lower = filename.lower()
    
    result = {
        "medications": [],
        "conditions": [],
        "lab_values": [],
        "dates": [],
        "doctor": None,
        "raw_text": f"[Mock extracted text for {filename}]"
    }
    
    if "prescription" in name_lower or kind == "prescription":
        result["medications"] = [
            {"name": _normalize_drug("napa"), "dose": "500mg"},
            {"name": _normalize_drug("amoxil"), "dose": "250mg"}
        ]
        result["conditions"] = ["Fever", "Bacterial Infection"]
        result["doctor"] = "Dr. Rahman"
        result["dates"] = ["2026-07-03"]
        
    elif "lab" in name_lower or kind == "lab_report":
        result["lab_values"] = [
            {"test": "Hemoglobin", "value": "13.5", "unit": "g/dL"},
            {"test": "WBC", "value": "6500", "unit": "/uL"}
        ]
        result["dates"] = ["2026-07-02"]
        
    elif "discharge" in name_lower or kind == "discharge":
        result["conditions"] = ["Dengue Fever"]
        result["medications"] = [
            {"name": _normalize_drug("paracetamol"), "dose": "500mg"}
        ]
        result["dates"] = ["2026-06-15"]
        result["doctor"] = "Dr. Ahmed"

    return result
