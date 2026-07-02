"""
Cross-cutting emergency detector. Called at the router level before any agent dispatch
so red flags are caught regardless of NLU intent classification.
"""
from __future__ import annotations

import re
from typing import Optional

from app.config import settings

_RED_FLAG_RULES: list[tuple[str, str]] = [
    (r"chest\s+pain|chest\s+pressure|chest\s+tight|heart\s+attack|বুকে\s+ব্যথা|বুকে\s+চাপ|হার্ট\s+অ্যাটাক", "chest pain"),
    (r"can'?t\s+breath|cannot\s+breath|difficulty\s+breath|shortness\s+of\s+breath|not\s+breath|struggling\s+to\s+breath|শ্বাস\s+নিতে\s+পার|শ্বাস\s+কষ্ট|শ্বাস\s+বন্ধ", "breathing difficulty"),
    (r"face.*?droop|drooping|facial.*?droop|one.sided\s+weak|arm\s+weak|slurred|speech.*?slur|sudden\s+confusion|stroke|মুখ\s+বাঁকা|কথা\s+জড়িয়ে|একদিক\s+দুর্বল", "stroke signs"),
    (r"severe\s+bleed|uncontrolled\s+bleed|bleed\s+heavily|blood\s+gush|প্রচুর\s+রক্ত|রক্তপাত\s+বন্ধ\s+হচ্ছে\s+না", "severe bleeding"),
    (r"unconscious|unresponsive|passed\s+out|won'?t\s+wake|not\s+waking|collapse|অজ্ঞান|সংজ্ঞাহীন|জ্ঞান\s+নেই", "unconsciousness"),
    (r"seizure|convuls|fitting|খিঁচুনি", "seizure"),
    (r"blue\s+lips?|lips?\s+blue|cyanosis|ঠোঁট\s+নীল", "blue lips / cyanosis"),
    (r"stiff\s+neck|neck\s+stiff|non.blanching\s+rash|গলা\s+শক্ত|গলা\s+ব্যথা.*শিশু|শিশু.*গলা\s+শক্ত", "meningitis signs"),
    (r"throat\s+swell|tongue\s+swell|anaphylax|severe\s+allergic|can'?t\s+swallow|গলা\s+ফুলে|জিহ্বা\s+ফুলে|মারাত্মক\s+অ্যালার্জি", "severe allergic reaction"),
]


def scan_red_flags(text: str) -> Optional[str]:
    """Returns the human-readable label of the first red flag hit, or None."""
    tl = text.lower()
    for pattern, label in _RED_FLAG_RULES:
        if re.search(pattern, tl):
            return label
    return None


def build_emergency_envelope(red_flag: str, member_ref: Optional[str], language: str) -> dict:
    """Build a full ResponseEnvelope for an emergency intercept."""
    num = settings.EMERGENCY_NUMBER
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
            "interpreted": "emergency detected",
            "urgency": "Emergency",
            "members": [member_ref] if member_ref else [],
        },
        "evidence": {
            "source": "Deterministic red-flag rule",
            "confidence": "HIGH",
            "grounding_score": 1.0,
        },
        "actions": [{"type": "call_emergency", "label": f"Call {num}", "target": num}],
        "member_focus": member_ref or None,
        "language": language,
    }
