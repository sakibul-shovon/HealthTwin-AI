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


def compose(envelope: dict, interpreted: str | None = None) -> dict:
    """
    Post-process a raw agent envelope before sending to the client.
    - Adds display.interpreted if not already present.
    - Enforces evidence requirement for medical verdicts.
    - Overrides spoken text for EMERGENCY.
    """
    if not isinstance(envelope, dict):
        return envelope

    verdict = envelope.get("verdict")
    language = envelope.get("language", "en")

    # ── Evidence guard ───────────────────────────────────────────────────────
    if verdict in MEDICAL_VERDICTS and verdict != "EMERGENCY":
        ev = envelope.get("evidence") or {}
        source = ev.get("source")
        confidence = ev.get("confidence")
        if not source or not confidence:
            envelope.setdefault("display", {})["detail"] = (
                "⚠ Evidence source missing — verdict withheld for safety." if language == "en"
                else "⚠ প্রমাণ উৎস পাওয়া যায়নি — নিরাপত্তার জন্য রায় দেওয়া হয়নি।"
            )
            envelope["verdict"] = "REFUSE"
            envelope["spoken"] = (
                "I cannot give a verdict without a verified source." if language == "en"
                else "যাচাইযোগ্য উৎস ছাড়া আমি রায় দিতে পারব না।"
            )

    # ── Emergency override ───────────────────────────────────────────────────
    if envelope.get("verdict") == "EMERGENCY":
        envelope["spoken"] = EMERGENCY_BN if language == "bn" else EMERGENCY_EN

    # ── Attach interpreted text ──────────────────────────────────────────────
    if interpreted is not None:
        display = envelope.setdefault("display", {})
        if not display.get("interpreted"):
            display["interpreted"] = interpreted

    return envelope
