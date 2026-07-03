"""
Report Agent — generates structured Markdown health reports from the graph + timeline.
Deterministic floor (no LLM required); optionally enhanced with Groq summary paragraph.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.graph.models import Member, Household, Relationship
from app.graph.risk import compute_risk
from app.memory.events import get_timeline
from app.config import settings

REPORT_TYPES = {
    "family_summary",
    "medication_report",
    "disease_history",
    "emergency_summary",
    "doctor_visit",
    "monthly",
}

_DISCLAIMER_EN = (
    "\n\n---\n"
    "*This report is generated from your family's HealthTwin records and is for "
    "informational purposes only. It is not a substitute for professional medical "
    "advice. Always consult a qualified doctor or pharmacist.*"
)
_DISCLAIMER_BN = (
    "\n\n---\n"
    "*এই রিপোর্টটি আপনার পরিবারের HealthTwin রেকর্ড থেকে তৈরি এবং শুধুমাত্র তথ্যের "
    "উদ্দেশ্যে প্রস্তুত। এটি পেশাদার চিকিৎসা পরামর্শের বিকল্প নয়। সর্বদা একজন যোগ্য "
    "ডাক্তার বা ফার্মাসিস্টের পরামর্শ নিন।*"
)


def _today(language: str) -> str:
    return datetime.now().strftime("%d %B %Y")


def _fmt_date(dt) -> str:
    if dt is None:
        return "—"
    return dt.strftime("%d %b %Y")


def _risk_emoji(band: str) -> str:
    return {"HIGH": "🔴", "MED": "🟡", "LOW": "🟢"}.get(band, "⚪")


def _caregiver_of(db: Session, member: Member) -> Optional[str]:
    """Return role_label of whoever is the caregiver FOR this member, or None."""
    rel = (
        db.query(Relationship)
        .filter(Relationship.to_member_id == member.id, Relationship.caregiver == True)
        .first()
    )
    if rel:
        cg = db.query(Member).filter(Member.id == rel.from_member_id).first()
        return cg.role_label if cg else None
    return None


def _llm_summary(question: str, facts: str, language: str) -> Optional[str]:
    """Optional Groq one-paragraph summary; returns None if no key or API fails."""
    if not settings.GROQ_API_KEY:
        return None
    try:
        from groq import Groq
        client = Groq(api_key=settings.GROQ_API_KEY)
        system = (
            "You are a family health assistant. Write ONE concise paragraph (under 60 words) "
            "summarising the key health observations from the data below. Be factual and calm. "
            "End with: 'Always consult a doctor for personal advice.'"
            if language != "bn" else
            "আপনি একজন পারিবারিক স্বাস্থ্য সহকারী। নিচের তথ্য থেকে মূল স্বাস্থ্য পর্যবেক্ষণ "
            "সংক্ষেপে এক অনুচ্ছেদে (৬০ শব্দের মধ্যে) লিখুন। শেষে যোগ করুন: 'ব্যক্তিগত পরামর্শের জন্য ডাক্তার দেখান।'"
        )
        resp = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"{question}\n\nData:\n{facts}"},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            max_tokens=120,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return None


def _member_block(m: Member, language: str, db: Session, include_timeline: bool = True) -> str:
    score, band, factors = compute_risk(m)
    meds = ", ".join(f"**{med.name}** {med.dose}" for med in m.medications) or (
        "none" if language == "en" else "কোনো ওষুধ নেই"
    )
    conditions = ", ".join(c.name for c in m.conditions) or (
        "none" if language == "en" else "কোনো রোগ নেই"
    )
    allergies = ", ".join(a.substance for a in m.allergies) or (
        "none" if language == "en" else "কোনো অ্যালার্জি নেই"
    )
    flags = []
    if m.kidney_impaired:
        flags.append("kidney impaired" if language == "en" else "কিডনি সমস্যা")
    if m.liver_impaired:
        flags.append("liver impaired" if language == "en" else "লিভার সমস্যা")
    if m.pregnant:
        flags.append("pregnant" if language == "en" else "গর্ভবতী")
    flags_str = ", ".join(flags) if flags else ("none" if language == "en" else "কোনো বিশেষ অবস্থা নেই")

    if language == "bn":
        lines = [
            f"### {m.role_label} ({m.display_name}), বয়স {m.age}",
            f"**ঝুঁকি:** {_risk_emoji(band)} **{band}**" + (f" — {', '.join(factors)}" if factors else ""),
            f"**ওষুধ:** {meds}",
            f"**রোগ:** {conditions}",
            f"**অ্যালার্জি:** {allergies}",
            f"**বিশেষ অবস্থা:** {flags_str}",
        ]
    else:
        lines = [
            f"### {m.role_label} ({m.display_name}), age {m.age} {m.sex}",
            f"**Risk:** {_risk_emoji(band)} **{band}**" + (f" — {', '.join(factors)}" if factors else ""),
            f"**Medications:** {meds}",
            f"**Conditions:** {conditions}",
            f"**Allergies:** {allergies}",
            f"**Flags:** {flags_str}",
        ]

    if include_timeline:
        events = get_timeline(db, m.id, limit=5)
        if events:
            lines.append("")
            lines.append("**Recent events:**" if language == "en" else "**সাম্প্রতিক ঘটনা:**")
            for e in events:
                detail = e.detail or {}
                desc = detail.get("name") or detail.get("symptom") or detail.get("drug") or ""
                tag = e.event_type.replace("_", " ")
                lines.append(f"- {_fmt_date(e.created_at)}: {tag}" + (f" — {desc}" if desc else ""))

    return "\n".join(lines)


def generate_report(
    db: Session,
    household_id: int,
    report_type: str,
    member_id: Optional[int] = None,
    language: str = "en",
) -> dict:
    if report_type not in REPORT_TYPES:
        report_type = "family_summary"

    today = _today(language)
    disclaimer = _DISCLAIMER_BN if language == "bn" else _DISCLAIMER_EN

    hh = db.query(Household).filter(Household.id == household_id).first()
    hh_name = hh.name if hh else "Family"
    all_members = db.query(Member).filter(Member.household_id == household_id).all()

    target: Optional[Member] = None
    if member_id:
        target = db.query(Member).filter(
            Member.id == member_id, Member.household_id == household_id
        ).first()

    # ── family_summary ────────────────────────────────────────────────────────
    if report_type == "family_summary":
        title = (
            f"{hh_name} — Family Health Summary"
            if language == "en"
            else f"{hh_name} — পারিবারিক স্বাস্থ্য সারসংক্ষেপ"
        )
        high_risk = [m for m in all_members if compute_risk(m)[1] == "HIGH"]

        if language == "bn":
            header_parts = [
                f"# {title}",
                f"**তারিখ:** {today}  |  **সদস্য:** {len(all_members)} জন",
            ]
            if high_risk:
                header_parts.append(f"**উচ্চ ঝুঁকি:** {', '.join(m.role_label for m in high_risk)}")
        else:
            header_parts = [
                f"# {title}",
                f"**Date:** {today}  |  **Members:** {len(all_members)}",
            ]
            if high_risk:
                header_parts.append(
                    f"**High-risk members:** {', '.join(m.role_label for m in high_risk)}"
                )

        facts_for_llm = "; ".join(
            f"{m.role_label}: {[med.name for med in m.medications]}, {[c.name for c in m.conditions]}"
            for m in all_members
        )
        ai_para = _llm_summary(f"Family health summary for {hh_name}", facts_for_llm, language)

        sections = header_parts + ["", "---", ""]
        if ai_para:
            sections += [
                f"## {'AI Summary' if language == 'en' else 'AI সারসংক্ষেপ'}",
                ai_para,
                "",
            ]
        sections.append(f"## {'Family Members' if language == 'en' else 'পরিবারের সদস্যরা'}")
        sections.append("")
        for m in all_members:
            sections.append(_member_block(m, language, db, include_timeline=True))
            sections.append("")

        sections.append(disclaimer)
        return {"title": title, "markdown": "\n".join(sections)}

    # ── medication_report ─────────────────────────────────────────────────────
    if report_type == "medication_report":
        members = [target] if target else all_members
        name = target.role_label if target else hh_name
        title = (
            f"{name} — Medication Report"
            if language == "en"
            else f"{name} — ওষুধের রিপোর্ট"
        )

        lines = [
            f"# {title}",
            f"**{'Date' if language == 'en' else 'তারিখ'}:** {today}",
            "",
            "---",
            "",
        ]
        for m in members:
            if not m.medications:
                lines.append(
                    f"### {m.role_label}: {'No medications on record' if language == 'en' else 'কোনো ওষুধ নেই'}\n"
                )
                continue
            lines.append(f"### {m.role_label} ({m.display_name})")
            header_row = (
                "| Medication | Dose |"
                if language == "en"
                else "| ওষুধ | ডোজ |"
            )
            lines += [header_row, "|---|---|"]
            for med in m.medications:
                lines.append(f"| {med.name} | {med.dose} |")
            allergies = [a.substance for a in m.allergies]
            if allergies:
                label = "Allergies" if language == "en" else "অ্যালার্জি"
                lines.append(f"\n**{label}:** {', '.join(allergies)}")
            lines.append("")

        lines.append(disclaimer)
        return {"title": title, "markdown": "\n".join(lines)}

    # ── disease_history ───────────────────────────────────────────────────────
    if report_type == "disease_history":
        m = target or (all_members[0] if all_members else None)
        name = m.role_label if m else hh_name
        title = (
            f"{name} — Disease History"
            if language == "en"
            else f"{name} — রোগের ইতিহাস"
        )

        lines = [
            f"# {title}",
            f"**{'Date' if language == 'en' else 'তারিখ'}:** {today}",
            "",
            "---",
            "",
        ]

        if m:
            score, band, factors = compute_risk(m)
            conditions = [c.name for c in m.conditions]

            lines += [
                f"**{'Risk level' if language == 'en' else 'ঝুঁকির মাত্রা'}:** {_risk_emoji(band)} {band}",
            ]
            if factors:
                label = "Risk factors" if language == "en" else "ঝুঁকির কারণ"
                lines.append(f"**{label}:** {', '.join(factors)}")
            lines.append("")

            if conditions:
                lines.append(f"## {'Conditions' if language == 'en' else 'রোগসমূহ'}")
                for c in conditions:
                    lines.append(f"- {c}")
                lines.append("")

            events = get_timeline(db, m.id, limit=30)
            if events:
                lines.append(f"## {'Health Timeline' if language == 'en' else 'স্বাস্থ্য সময়রেখা'}")
                for e in events:
                    detail = e.detail or {}
                    desc = detail.get("name") or detail.get("symptom") or detail.get("drug") or ""
                    tag = e.event_type.replace("_", " ")
                    lines.append(
                        f"- **{_fmt_date(e.created_at)}** — {tag}" + (f": {desc}" if desc else "")
                    )
                lines.append("")
            else:
                lines.append(
                    f"*{'No health events recorded yet.' if language == 'en' else 'এখনো কোনো স্বাস্থ্য ঘটনা রেকর্ড হয়নি।'}*\n"
                )

        lines.append(disclaimer)
        return {"title": title, "markdown": "\n".join(lines)}

    # ── emergency_summary ─────────────────────────────────────────────────────
    if report_type == "emergency_summary":
        m = target or (all_members[0] if all_members else None)
        name = m.role_label if m else hh_name
        title = (
            f"{name} — Emergency Medical Summary"
            if language == "en"
            else f"{name} — জরুরি চিকিৎসা সারসংক্ষেপ"
        )

        warn = (
            "> ⚠️ **For emergency responders — show this card to the treating doctor immediately.**"
            if language == "en"
            else "> ⚠️ **জরুরি স্বাস্থ্যকর্মীদের জন্য — চিকিৎসকের কাছে এই কার্ডটি অবিলম্বে দেখান।**"
        )

        lines = [f"# 🚨 {title}", f"**{'Date' if language == 'en' else 'তারিখ'}:** {today}", "", warn, "", "---", ""]

        if m:
            meds_str = ", ".join(f"{med.name} {med.dose}" for med in m.medications) or "none"
            allergies_str = ", ".join(a.substance for a in m.allergies) or "none"
            conditions_str = ", ".join(c.name for c in m.conditions) or "none"
            flags = []
            if m.kidney_impaired:
                flags.append("kidney impaired")
            if m.liver_impaired:
                flags.append("liver impaired")
            if m.pregnant:
                flags.append("pregnant")
            flags_str = ", ".join(flags) or "none"
            blood = getattr(m, "blood_group", None) or ("unknown" if language == "en" else "অজানা")
            caregiver = _caregiver_of(db, m) or ("see family" if language == "en" else "পরিবারকে দেখুন")

            if language == "bn":
                lines += [
                    f"**নাম:** {m.display_name} ({m.role_label})",
                    f"**বয়স:** {m.age}  |  **লিঙ্গ:** {m.sex}  |  **রক্তের গ্রুপ:** {blood}",
                    "",
                    f"**বর্তমান ওষুধ:** {meds_str}",
                    f"**অ্যালার্জি:** {allergies_str}",
                    f"**রোগ:** {conditions_str}",
                    f"**বিশেষ অবস্থা:** {flags_str}",
                    "",
                    f"**পরিচর্যাকারী:** {caregiver}",
                ]
            else:
                lines += [
                    f"**Name:** {m.display_name} ({m.role_label})",
                    f"**Age:** {m.age}  |  **Sex:** {m.sex}  |  **Blood group:** {blood}",
                    "",
                    f"**Current medications:** {meds_str}",
                    f"**Allergies:** {allergies_str}",
                    f"**Conditions:** {conditions_str}",
                    f"**Flags:** {flags_str}",
                    "",
                    f"**Emergency contact / Caregiver:** {caregiver}",
                ]

        lines.append(disclaimer)
        return {"title": title, "markdown": "\n".join(lines)}

    # ── doctor_visit ──────────────────────────────────────────────────────────
    if report_type == "doctor_visit":
        m = target or (all_members[0] if all_members else None)
        name = m.role_label if m else hh_name
        title = (
            f"{name} — Doctor Visit Summary"
            if language == "en"
            else f"{name} — ডাক্তার ভিজিট সারসংক্ষেপ"
        )

        lines = [
            f"# {title}",
            f"**{'Date' if language == 'en' else 'তারিখ'}:** {today}",
            "",
            "---",
            "",
        ]

        if m:
            score, band, factors = compute_risk(m)

            if language == "bn":
                lines += [
                    f"## রোগীর প্রোফাইল",
                    f"**নাম:** {m.display_name}  |  **বয়স:** {m.age}  |  **লিঙ্গ:** {m.sex}",
                    f"**ঝুঁকি:** {_risk_emoji(band)} {band}" + (f" — {', '.join(factors)}" if factors else ""),
                    "",
                    "## বর্তমান ওষুধ",
                ]
            else:
                lines += [
                    "## Patient Profile",
                    f"**Name:** {m.display_name}  |  **Age:** {m.age}  |  **Sex:** {m.sex}",
                    f"**Risk level:** {_risk_emoji(band)} {band}" + (f" — {', '.join(factors)}" if factors else ""),
                    "",
                    "## Current Medications",
                ]
            for med in m.medications:
                lines.append(f"- {med.name} {med.dose}")
            if not m.medications:
                lines.append("- " + ("None" if language == "en" else "কোনো ওষুধ নেই"))
            lines.append("")

            cond_label = "## Conditions" if language == "en" else "## রোগসমূহ"
            lines.append(cond_label)
            for c in m.conditions:
                lines.append(f"- {c.name}")
            if not m.conditions:
                lines.append("- " + ("None" if language == "en" else "কোনো রোগ নেই"))
            lines.append("")

            allergy_label = "## Allergies" if language == "en" else "## অ্যালার্জি"
            lines.append(allergy_label)
            for a in m.allergies:
                lines.append(f"- {a.substance}")
            if not m.allergies:
                lines.append("- " + ("None" if language == "en" else "কোনো অ্যালার্জি নেই"))
            lines.append("")

            events = get_timeline(db, m.id, limit=5)
            if events:
                event_label = "## Recent Health Events" if language == "en" else "## সাম্প্রতিক স্বাস্থ্য ঘটনা"
                lines.append(event_label)
                for e in events:
                    detail = e.detail or {}
                    desc = detail.get("name") or detail.get("symptom") or detail.get("drug") or ""
                    tag = e.event_type.replace("_", " ")
                    lines.append(f"- {_fmt_date(e.created_at)}: {tag}" + (f" — {desc}" if desc else ""))
                lines.append("")

        lines.append(disclaimer)
        return {"title": title, "markdown": "\n".join(lines)}

    # ── monthly ───────────────────────────────────────────────────────────────
    if report_type == "monthly":
        month_name = datetime.now().strftime("%B %Y")
        title = (
            f"{hh_name} — Monthly Health Report ({month_name})"
            if language == "en"
            else f"{hh_name} — মাসিক স্বাস্থ্য রিপোর্ট ({month_name})"
        )

        lines = [
            f"# {title}",
            f"**{'Generated' if language == 'en' else 'তৈরি'}:** {today}",
            "",
            "---",
            "",
        ]

        overview_label = "## Household Overview" if language == "en" else "## পরিবারের সংক্ষিপ্ত বিবরণ"
        lines.append(overview_label)
        for m in all_members:
            score, band, _ = compute_risk(m)
            med_count = len(m.medications)
            cond_count = len(m.conditions)
            lines.append(
                f"- **{m.role_label}** ({m.display_name}, age {m.age}) — "
                f"Risk: {_risk_emoji(band)} {band}, "
                f"{med_count} med{'s' if med_count != 1 else ''}, "
                f"{cond_count} condition{'s' if cond_count != 1 else ''}"
            )
        lines.append("")

        # Collect all events across household
        all_events: list[tuple[str, object]] = []
        for m in all_members:
            for e in get_timeline(db, m.id, limit=10):
                all_events.append((m.role_label, e))
        all_events.sort(
            key=lambda x: x[1].created_at or datetime.min, reverse=True
        )

        event_label = "## Activity This Month" if language == "en" else "## এই মাসের কার্যক্রম"
        lines.append(event_label)
        if all_events:
            for role_label, e in all_events[:15]:
                detail = e.detail or {}
                desc = detail.get("name") or detail.get("symptom") or detail.get("drug") or ""
                tag = e.event_type.replace("_", " ")
                lines.append(
                    f"- **{role_label}** [{_fmt_date(e.created_at)}]: {tag}"
                    + (f" — {desc}" if desc else "")
                )
        else:
            lines.append(
                "- " + (
                    "No events recorded yet." if language == "en"
                    else "এখনো কোনো ঘটনা রেকর্ড হয়নি।"
                )
            )
        lines.append("")
        lines.append(disclaimer)
        return {"title": title, "markdown": "\n".join(lines)}

    # unreachable fallback
    return {"title": "Report", "markdown": f"# Report\n\nUnknown report type: {report_type}." + disclaimer}
