"""
Composer enforces two invariants:
1. Any medical verdict (UNSAFE/CAUTION/SAFE) MUST have evidence source+confidence.
2. EMERGENCY verdict always overrides spoken text with escalation message.
It also attaches display.interpreted from the upstream NLU step.
"""

EMERGENCY_EN = ("This is a medical emergency — call 999 or go to the nearest hospital immediately. "
                "Do NOT wait.")
EMERGENCY_BN = ("এটি একটি মেডিকেল ইমার্জেন্সি — এখনই ৯৯৯ কল করুন অথবা নিকটতম হাসপাতালে যান।"
                " দেরি করবেন না।")

MEDICAL_VERDICTS = {"UNSAFE", "CAUTION", "SAFE", "EMERGENCY"}

_UNVERIFIED_DISCLAIMER_EN = (
    "This is general information only and has not been verified against clinical sources. "
    "Consult a doctor before acting on this."
)
_UNVERIFIED_DISCLAIMER_BN = (
    "এটি শুধুমাত্র সাধারণ তথ্য এবং ক্লিনিকাল উৎস থেকে যাচাই করা হয়নি। "
    "এর উপর ভিত্তি করে কোনো পদক্ষেপ নেওয়ার আগে ডাক্তারের পরামর্শ নিন।"
)


def compose(envelope: dict, interpreted: str | None = None) -> dict:
    """
    Post-process a raw agent envelope before sending to the client.
    - Enforces evidence requirement for medical verdicts.
    - Guards INFO verdicts: no-source → REFUSE; unverified → enforce LOW + disclaimer.
    - Catches float confidence and converts to string.
    - Overrides spoken text for EMERGENCY.
    """
    if not isinstance(envelope, dict):
        return envelope

    verdict = envelope.get("verdict")
    language = envelope.get("language", "en")

    # ── Float confidence guard (catch regressions) ───────────────────────────
    ev = envelope.get("evidence") or {}
    confidence = ev.get("confidence")
    if isinstance(confidence, float):
        ev["confidence"] = "HIGH" if confidence >= 0.75 else "MED" if confidence >= 0.5 else "LOW"
        envelope["evidence"] = ev

    # ── Evidence guard for medical verdicts ──────────────────────────────────
    if verdict in MEDICAL_VERDICTS and verdict not in ("EMERGENCY", "CLARIFY"):
        ev = envelope.get("evidence") or {}
        if not ev.get("source") or not ev.get("confidence"):
            envelope.setdefault("display", {})["detail"] = (
                "Evidence source missing — verdict withheld for safety." if language == "en"
                else "প্রমাণ উৎস পাওয়া যায়নি — নিরাপত্তার জন্য রায় দেওয়া হয়নি।"
            )
            envelope["verdict"] = "REFUSE"
            envelope["spoken"] = (
                "I cannot give a verdict without a verified source." if language == "en"
                else "যাচাইযোগ্য উৎস ছাড়া আমি রায় দিতে পারব না।"
            )

    # ── INFO guard ───────────────────────────────────────────────────────────
    if verdict == "INFO":
        ev = envelope.get("evidence") or {}
        source = ev.get("source") or ""
        if not source:
            envelope["verdict"] = "REFUSE"
            envelope["spoken"] = (
                "I cannot verify this. Please consult a doctor." if language == "en"
                else "আমি এটি যাচাই করতে পারছি না। দয়া করে ডাক্তারের পরামর্শ নিন।"
            )
        elif "unverified" in source.lower():
            ev["confidence"] = "LOW"
            envelope["evidence"] = ev
            disclaimer = _UNVERIFIED_DISCLAIMER_BN if language == "bn" else _UNVERIFIED_DISCLAIMER_EN
            detail = envelope.get("display", {}).get("detail", "")
            if disclaimer not in detail:
                envelope.setdefault("display", {})["detail"] = f"{detail}\n\n{disclaimer}".strip()

    # ── Emergency override ───────────────────────────────────────────────────
    if envelope.get("verdict") == "EMERGENCY":
        envelope["spoken"] = EMERGENCY_BN if language == "bn" else EMERGENCY_EN

    # ── Attach interpreted text ──────────────────────────────────────────────
    if interpreted is not None:
        display = envelope.setdefault("display", {})
        if not display.get("interpreted"):
            display["interpreted"] = interpreted

    return envelope
