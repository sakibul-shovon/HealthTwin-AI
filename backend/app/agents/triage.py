"""
Triage Agent — urgency classification with deterministic red-flag override.

Order (non-negotiable):
  1. Red-flag scan → EMERGENCY if any hit (LLM is NEVER called for emergencies)
  2. Deterministic urgency thresholds (temperature, age, risk factors)
  3. Result → ResponseEnvelope with display.urgency field
"""
from __future__ import annotations

import re
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.graph.crud import resolve_member

# ── Red-flag rules (CONVENTIONS §9) ─────────────────────────────────────────
# Each entry: (regex_pattern, human_readable_label)
_RED_FLAG_RULES: list[tuple[str, str]] = [
    # Chest / cardiac
    (r"chest\s+pain|chest\s+pressure|chest\s+tight|heart\s+attack|বুকে\s+ব্যথা|বুকে\s+চাপ|হার্ট\s+অ্যাটাক", "chest pain"),
    # Breathing
    (r"can'?t\s+breath|cannot\s+breath|difficulty\s+breath|shortness\s+of\s+breath|not\s+breath|struggling\s+to\s+breath|শ্বাস\s+নিতে\s+পার|শ্বাস\s+কষ্ট|শ্বাস\s+বন্ধ", "breathing difficulty"),
    # Stroke signs — use loose patterns to catch "face is drooping", "speech is slurred", etc.
    (r"face.*?droop|drooping|facial.*?droop|one.sided\s+weak|arm\s+weak|slurred|speech.*?slur|sudden\s+confusion|stroke|মুখ\s+বাঁকা|কথা\s+জড়িয়ে|একদিক\s+দুর্বল", "stroke signs"),
    # Bleeding
    (r"severe\s+bleed|uncontrolled\s+bleed|bleed\s+heavily|blood\s+gush|প্রচুর\s+রক্ত|রক্তপাত\s+বন্ধ\s+হচ্ছে\s+না", "severe bleeding"),
    # Unconsciousness
    (r"unconscious|unresponsive|passed\s+out|won'?t\s+wake|not\s+waking|collapse|অজ্ঞান|সংজ্ঞাহীন|জ্ঞান\s+নেই", "unconsciousness"),
    # Seizure
    (r"seizure|convuls|fitting|খিঁচুনি", "seizure"),
    # Cyanosis
    (r"blue\s+lips?|lips?\s+blue|cyanosis|ঠোঁট\s+নীল", "blue lips / cyanosis"),
    # Meningitis (infant fever + danger signs)
    (r"stiff\s+neck|neck\s+stiff|non.blanching\s+rash|গলা\s+শক্ত|গলা\s+ব্যথা.*শিশু|শিশু.*গলা\s+শক্ত", "meningitis signs"),
    # Anaphylaxis
    (r"throat\s+swell|tongue\s+swell|anaphylax|severe\s+allergic|can'?t\s+swallow|গলা\s+ফুলে|জিহ্বা\s+ফুলে|মারাত্মক\s+অ্যালার্জি", "severe allergic reaction"),
]

_URGENCY_LABELS = ("Emergency", "Urgent", "Moderate", "Low")

_URGENCY_VERDICT = {
    "Emergency": "EMERGENCY",
    "Urgent": "CAUTION",
    "Moderate": "CAUTION",
    "Low": "INFO",
}

_NEXT_STEPS = {
    "Emergency": {
        "en": "Call {num} immediately or go to the nearest hospital now. Do not wait.",
        "bn": "এখনই {num} এ ফোন করুন বা নিকটতম হাসপাতালে যান। দেরি করবেন না।",
    },
    "Urgent": {
        "en": "See a doctor or go to an urgent-care centre within a few hours.",
        "bn": "কয়েক ঘণ্টার মধ্যে ডাক্তার দেখান বা নিকটতম ক্লিনিকে যান।",
    },
    "Moderate": {
        "en": "Monitor closely. If symptoms worsen or persist beyond 24 hours, see a doctor.",
        "bn": "লক্ষণ পর্যবেক্ষণ করুন। ২৪ ঘণ্টার মধ্যে না কমলে বা খারাপ হলে ডাক্তার দেখান।",
    },
    "Low": {
        "en": "Symptoms appear mild. Rest, stay hydrated, and monitor for any changes.",
        "bn": "উপসর্গগুলো হালকা মনে হচ্ছে। বিশ্রাম নিন, তরল পান করুন এবং পরিবর্তন লক্ষ্য করুন।",
    },
}


# ── Temperature extraction ────────────────────────────────────────────────────

def _extract_temp_fahrenheit(text: str) -> Optional[float]:
    tl = text.lower()
    # Explicit Fahrenheit: "102f", "102°f", "102 fahrenheit"
    m = re.search(r"(\d{2,3}(?:\.\d)?)\s*°?\s*(?:f|fahrenheit)\b", tl)
    if m:
        return float(m.group(1))
    # Explicit Celsius: "38.5c", "38°c", "38 celsius"
    m = re.search(r"(\d{2}(?:\.\d)?)\s*°?\s*(?:c|celsius)\b", tl)
    if m:
        return float(m.group(1)) * 9 / 5 + 32
    # Number near fever/temperature keywords (infer unit from range)
    m = re.search(r"(?:fever|temperature|temp|জ্বর|তাপমাত্রা)\D{0,15}(\d{2,3}(?:\.\d)?)", tl)
    if m:
        val = float(m.group(1))
        if 36.0 <= val <= 42.5:
            return val * 9 / 5 + 32   # Celsius
        if 97.0 <= val <= 110.0:
            return val                  # Fahrenheit
    return None


# ── Red-flag scanner (deterministic — runs FIRST, no LLM) ────────────────────

def _scan_red_flags(symptom_text: str) -> Optional[str]:
    """Returns the human-readable label of the first red flag hit, or None."""
    tl = symptom_text.lower()
    for pattern, label in _RED_FLAG_RULES:
        if re.search(pattern, tl):
            return label
    return None


# ── Urgency classifier (deterministic thresholds) ────────────────────────────

def _classify_urgency(
    symptom_text: str,
    age: Optional[int],
    high_risk: bool,
) -> tuple[str, str]:
    """Returns (urgency_band, next_step_en)."""
    tl = symptom_text.lower()
    temp_f = _extract_temp_fahrenheit(symptom_text)

    # Temperature-based URGENT
    if temp_f is not None:
        if temp_f >= 103.0:
            return "Urgent", "High fever (≥103°F / 39.4°C) — see a doctor today."
        if temp_f >= 102.0 and (age is not None and (age <= 5 or age >= 65 or high_risk)):
            return "Urgent", "High fever in a vulnerable patient — see a doctor today."

    # Keyword-based URGENT
    urgent_kws = [
        "vomiting blood", "coughing blood", "blood in urine", "black stool",
        "severe pain", "severe headache", "sudden severe",
        "রক্ত বমি", "রক্ত কাশি",
    ]
    if any(k in tl for k in urgent_kws):
        return "Urgent", "Symptom needs medical attention within a few hours."

    # MODERATE
    moderate_kws = [
        "fever", "vomiting", "diarrhea", "headache", "dizziness",
        "weakness", "fatigue", "nausea", "pain", "rash",
        "জ্বর", "বমি", "মাথা ব্যথা", "ব্যথা", "দুর্বলতা", "র‍্যাশ",
    ]
    if temp_f is not None and temp_f >= 100.0:
        return "Moderate", "Monitor fever. See a doctor if it exceeds 103°F or lasts more than 2 days."
    if any(k in tl for k in moderate_kws):
        return "Moderate", "Monitor symptoms. See a doctor if they worsen or persist beyond 2 days."

    # LOW
    return "Low", "Symptoms appear mild. Rest, stay hydrated, and monitor for any changes."


# ── Main entry point ──────────────────────────────────────────────────────────

def run_triage(
    db: Session,
    household_id: int,
    member_ref: str,
    symptom_text: str,
    language: str = "en",
) -> dict:
    num = settings.EMERGENCY_NUMBER

    # ── Step 1: Red-flag scan (DETERMINISTIC — no LLM, always first) ─────────
    red_flag = _scan_red_flags(symptom_text)
    if red_flag:
        if language == "bn":
            spoken = (
                f"এটি জরুরি অবস্থা হতে পারে — এখনই {num} এ ফোন করুন "
                "বা নিকটতম হাসপাতালে যান। দেরি করবেন না।"
            )
            detail = f"জরুরি লক্ষণ শনাক্ত হয়েছে: {red_flag}। এটি জীবন-হুমকির পরিস্থিতি হতে পারে।"
        else:
            spoken = (
                f"This may be an emergency — call {num} or go to the nearest hospital now. "
                "Do not wait."
            )
            detail = (
                f"Emergency red flag detected: {red_flag}. "
                "This could be a life-threatening situation. "
                f"Call {num} immediately — do NOT try to manage this at home."
            )
        return {
            "verdict": "EMERGENCY",
            "spoken": spoken,
            "display": {
                "title": "Emergency — Act Now",
                "conflict": red_flag,
                "alternative": None,
                "detail": detail,
                "member": member_ref or None,
                "interpreted": f"triage check for {member_ref or 'member'}",
                "urgency": "Emergency",
                "members": [member_ref] if member_ref else [],
            },
            "evidence": {
                "source": "Deterministic red-flag rule (CONVENTIONS §9)",
                "confidence": "HIGH",
                "grounding_score": 1.0,
            },
            "actions": [
                {"type": "call_emergency", "label": f"Call {num}", "target": num},
            ],
            "member_focus": member_ref or None,
            "language": language,
        }

    # ── Step 2: Resolve member for context-aware urgency ─────────────────────
    age: Optional[int] = None
    high_risk = False
    if member_ref:
        member = resolve_member(db, household_id, member_ref)
        if member:
            age = member.age
            high_risk = (
                member.kidney_impaired
                or member.liver_impaired
                or any("diabetes" in c.name.lower() for c in member.conditions)
            )

    # ── Step 3: Deterministic urgency classification ──────────────────────────
    urgency, next_step_en = _classify_urgency(symptom_text, age, high_risk)
    verdict = _URGENCY_VERDICT[urgency]
    next_step = _NEXT_STEPS[urgency][language].format(num=num)

    if language == "bn":
        urgency_labels = {
            "Urgent": "জরুরি", "Moderate": "মাঝারি", "Low": "হালকা",
        }
        urgency_bn = urgency_labels.get(urgency, urgency)
        spoken = (
            f"{'জরুরি' if urgency == 'Urgent' else 'মাঝারি' if urgency == 'Moderate' else 'হালকা'} "
            f"উপসর্গ। {next_step}"
        )
        title = f"ট্রিয়াজ — {urgency_bn}"
    else:
        spoken = f"{urgency} urgency. {next_step}"
        title = f"Triage — {urgency}"

    disclaimer = ("Always consult a qualified healthcare professional. "
                  "HealthTwin is a decision-support tool, not a diagnosis." if language == "en"
                  else "সর্বদা একজন যোগ্য স্বাস্থ্যসেবা পেশাদারের পরামর্শ নিন।")

    return {
        "verdict": verdict,
        "spoken": spoken,
        "display": {
            "title": title,
            "conflict": None,
            "alternative": next_step,
            "detail": f"{next_step}\n\n{disclaimer}",
            "member": member_ref or None,
            "interpreted": f"triage check for {member_ref or 'member'}",
            "urgency": urgency,
            "members": [member_ref] if member_ref else [],
        },
        "evidence": {
            "source": "Deterministic triage rule",
            "confidence": "MED",
            "grounding_score": 0.82,
        },
        "actions": [],
        "member_focus": member_ref or None,
        "language": language,
    }
