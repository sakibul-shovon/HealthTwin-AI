"""
Real document extraction.

- Images (jpg/png): read by a vision LLM (Llama 4 Scout on Groq) — actual OCR of the
  photographed prescription/report, not a filename guess.
- PDFs: text extracted with pypdf, then structured by an LLM. Scanned (image-only) PDFs
  with no embedded text are reported honestly instead of returning fake data.
- No API key / failure: returns an EMPTY result with an error note — never invents meds.
"""
import os
import io
import json
import base64
from typing import Dict, Any

from app.config import settings

VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
# Text-structuring fallback chain — each Groq model has its own daily quota, so if
# one is rate-limited we roll to the next instead of failing the upload.
STRUCTURE_MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "llama-3.1-8b-instant",
]

_EXTRACT_INSTRUCTION = (
    "You are a medical document reader. Extract ONLY what is actually written in this "
    "document. Return STRICT JSON with this exact shape:\n"
    "{\n"
    '  "medications": [{"name": "<drug>", "dose": "<dose or empty>"}],\n'
    '  "conditions": ["<condition>"],\n'
    '  "lab_values": [{"test": "<name>", "value": "<value>", "unit": "<unit>"}],\n'
    '  "dates": ["YYYY-MM-DD"],\n'
    '  "doctor": "<name or null>"\n'
    "}\n"
    "Rules: Do NOT invent anything. If a field is not present, use an empty list or null. "
    "Copy drug names and doses exactly as written. Output JSON only, no prose."
)


def _empty(note: str, raw_text: str = "") -> Dict[str, Any]:
    return {
        "medications": [],
        "conditions": [],
        "lab_values": [],
        "dates": [],
        "doctor": None,
        "raw_text": raw_text,
        "note": note,
    }


def _load_synonyms() -> dict:
    try:
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
        with open(os.path.join(data_dir, "drug_synonyms.json"), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


DRUG_SYNONYMS = _load_synonyms()


def _normalize_drug(name: str) -> str:
    lower_name = (name or "").lower().strip()
    for canonical, synonyms in DRUG_SYNONYMS.items():
        if lower_name == canonical.lower():
            return canonical
        if lower_name in [s.lower() for s in synonyms]:
            return canonical
    return name


def _coerce_result(data: dict, raw_text: str) -> Dict[str, Any]:
    """Validate/normalize the LLM's JSON into our schema; drop anything malformed."""
    meds = []
    for m in data.get("medications") or []:
        if isinstance(m, dict) and m.get("name"):
            meds.append({"name": _normalize_drug(str(m["name"])), "dose": str(m.get("dose") or "").strip()})
        elif isinstance(m, str) and m.strip():
            meds.append({"name": _normalize_drug(m), "dose": ""})
    conditions = [str(c).strip() for c in (data.get("conditions") or []) if str(c).strip()]
    labs = []
    for lv in data.get("lab_values") or []:
        if isinstance(lv, dict) and lv.get("test"):
            labs.append({"test": str(lv["test"]).strip(),
                         "value": str(lv.get("value") or "").strip(),
                         "unit": str(lv.get("unit") or "").strip()})
    dates = [str(d).strip() for d in (data.get("dates") or []) if str(d).strip()]
    doctor = data.get("doctor")
    doctor = str(doctor).strip() if doctor else None
    return {
        "medications": meds,
        "conditions": conditions,
        "lab_values": labs,
        "dates": dates,
        "doctor": doctor,
        "raw_text": raw_text,
    }


def _parse_json_loose(text: str) -> dict:
    """Extract the first JSON object from an LLM reply."""
    text = (text or "").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


def _instruction(kind: str) -> str:
    hint = f"\nThe user says this document is a '{kind}'." if kind else ""
    return _EXTRACT_INSTRUCTION + hint


def _extract_image(file_bytes: bytes, filename: str, kind: str = "") -> Dict[str, Any]:
    if not settings.GROQ_API_KEY:
        return _empty("No API key configured — cannot read the document.")
    name_l = (filename or "").lower()
    if name_l.endswith(".png"):
        mime = "image/png"
    elif name_l.endswith(".webp"):
        mime = "image/webp"
    else:
        mime = "image/jpeg"
    b64 = base64.b64encode(file_bytes).decode("ascii")
    data_uri = f"data:{mime};base64,{b64}"
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        resp = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": _instruction(kind)},
                    {"type": "image_url", "image_url": {"url": data_uri}},
                ],
            }],
            temperature=0,
            max_tokens=800,
        )
        content = resp.choices[0].message.content or ""
        data = _parse_json_loose(content)
        return _coerce_result(data, raw_text=content)
    except Exception as e:
        return _empty(f"Could not read the image ({type(e).__name__}). Please try a clearer photo.")


def _pdf_text(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        return "\n".join((page.extract_text() or "") for page in reader.pages).strip()
    except Exception:
        return ""


def _structure_text(raw_text: str, kind: str = "") -> Dict[str, Any]:
    if not settings.GROQ_API_KEY:
        return _empty("No API key configured — cannot structure the document.", raw_text=raw_text)
    from groq import Groq, RateLimitError
    client = Groq(api_key=settings.GROQ_API_KEY)
    last_err = "unknown error"
    for model in STRUCTURE_MODELS:
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": _instruction(kind)},
                    {"role": "user", "content": raw_text[:6000]},
                ],
                temperature=0,
                response_format={"type": "json_object"},
                max_tokens=800,
            )
            data = _parse_json_loose(resp.choices[0].message.content or "")
            return _coerce_result(data, raw_text=raw_text)
        except RateLimitError:
            last_err = "all models rate-limited"
            continue  # this model's daily quota is spent — try the next
        except Exception as e:
            last_err = type(e).__name__
            continue
    return _empty(f"Could not structure the document ({last_err}).", raw_text=raw_text)


def extract(file_bytes: bytes, filename: str, kind: str) -> Dict[str, Any]:
    """Extract structured entities from a real uploaded document."""
    name_lower = (filename or "").lower()
    is_pdf = name_lower.endswith(".pdf")

    if is_pdf:
        text = _pdf_text(file_bytes)
        if not text:
            return _empty(
                "This looks like a scanned PDF with no readable text. "
                "Please upload a clear photo (JPG/PNG) of the document instead."
            )
        return _structure_text(text, kind)

    # Treat everything else as an image (upload endpoint already restricts to jpg/png/pdf).
    return _extract_image(file_bytes, filename, kind)
