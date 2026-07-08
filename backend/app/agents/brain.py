"""
HealthTwin Brain — a single LLM tool-calling agent.

Replaces the old keyword-matching stack (mock NLU + router keyword tables +
companion gating). One LLM understands the request, decides which REAL function
to call (drug-safety engine, family records, triage, medical knowledge, or a
confirm-before-commit write), and composes the answer from real data.

Cost control:
  - Greeting / chit-chat / general question the model can answer itself → 1 LLM call, 0 tools.
  - A "terminal" tool (drug safety, triage, pattern, report, write) → 1 LLM call; its
    envelope is returned directly (it already carries a full verdict card).
  - A "data" tool (family overview, member records, medical KB) → 2 LLM calls
    (route + compose). Never more than 2 calls per turn.
"""
from __future__ import annotations

import json
from typing import Optional

from sqlalchemy.orm import Session, joinedload
from groq import Groq, RateLimitError, APIError

from app.config import settings
from app import groq_pool
from app.graph.models import Member
from app.graph.crud import resolve_member
from app.agents.safety import run_safety_check
from app.agents.triage import run_triage
from app.agents.pattern import run_pattern_check
from app.spine.grounded_answer import grounded_explain
from app.voice.nlu import NluResult, EntityInfo
from app.voice.pending import store_pending

# Model fallback chain. Each Groq model has its OWN daily token quota, so when the
# primary hits its 429 daily limit the brain rolls to the next model instead of
# dying or silently degrading. Ordered best-quality → cheapest.
BRAIN_MODELS = [
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instant",
]
# Optional override from env (GROQ_BRAIN_MODEL) is tried first.
if getattr(settings, "GROQ_BRAIN_MODEL", ""):
    BRAIN_MODELS = [settings.GROQ_BRAIN_MODEL] + [m for m in BRAIN_MODELS if m != settings.GROQ_BRAIN_MODEL]


class AllModelsRateLimited(Exception):
    """Every model in the fallback chain returned a daily rate-limit error."""


def _chat(client: Groq, **kwargs):
    """Call Groq, rolling through BRAIN_MODELS then API keys on rate-limit errors."""
    last_exc: Exception | None = None
    keys_tried = 0
    current_client = client

    while keys_tried < groq_pool.key_count():
        for model in BRAIN_MODELS:
            try:
                return current_client.chat.completions.create(model=model, **kwargs)
            except RateLimitError as e:
                last_exc = e
                continue
            except APIError as e:
                last_exc = e
                continue
        # All models exhausted for this key — rotate to the next API key and retry
        groq_pool.rotate()
        current_client = groq_pool.get_client()
        keys_tried += 1

    if isinstance(last_exc, RateLimitError):
        raise AllModelsRateLimited() from last_exc
    raise last_exc if last_exc else RuntimeError("No model available")

_DISCLAIMER_EN = "Consult a doctor for personal medical advice."
_DISCLAIMER_BN = "ব্যক্তিগত পরামর্শের জন্য ডাক্তার দেখান।"


# ── Real-data context helpers ────────────────────────────────────────────────
def _member_line(m: Member) -> str:
    meds = ", ".join(f"{med.name} {med.dose}" for med in m.medications) or "none"
    conditions = ", ".join(c.name for c in m.conditions) or "none"
    allergies = ", ".join(a.substance for a in m.allergies) or "none"
    flags = [f for f, v in [("kidney impaired", m.kidney_impaired),
                            ("liver impaired", m.liver_impaired),
                            ("pregnant", m.pregnant)] if v]
    line = (f"- {m.role_label} ({m.display_name}), age {m.age}, {m.sex}: "
            f"conditions={conditions}; meds={meds}; allergies={allergies}")
    if flags:
        line += f"; flags={', '.join(flags)}"
    return line


def _all_members(db: Session, household_id: int) -> list[Member]:
    return (
        db.query(Member)
        .options(
            joinedload(Member.medications),
            joinedload(Member.conditions),
            joinedload(Member.allergies),
        )
        .filter(Member.household_id == household_id)
        .all()
    )


def _family_context(db: Session, household_id: int) -> str:
    members = _all_members(db, household_id)
    return "\n".join(_member_line(m) for m in members) or "No family members on record."


def _roster(db: Session, household_id: int) -> str:
    """Lightweight member list for the system prompt (names only — full records come from tools)."""
    members = (
        db.query(Member)
        .filter(Member.household_id == household_id)
        .all()
    )
    if not members:
        return "No family members on record."
    return ", ".join(f"{m.role_label} ({m.display_name}, {m.age})" for m in members)


def _member_context(db: Session, household_id: int, label: str) -> str:
    m = resolve_member(db, household_id, label)
    if not m:
        return f"No family member matching '{label}' was found."
    m = (
        db.query(Member)
        .options(
            joinedload(Member.medications),
            joinedload(Member.conditions),
            joinedload(Member.allergies),
            joinedload(Member.symptoms),
        )
        .filter(Member.id == m.id)
        .first()
    )
    line = _member_line(m)
    recent = sorted(m.symptoms, key=lambda s: s.logged_at, reverse=True)[:3]
    if recent:
        line += "; recent symptoms=" + ", ".join(s.symptom for s in recent)
    return line


# ── Tool schemas exposed to the LLM ──────────────────────────────────────────
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_drug_safety",
            "description": (
                "Check whether a specific medicine/drug is safe for a specific family member, "
                "using the verified drug-interaction, allergy, contraindication and dose engine. "
                "Call this for ANY question about whether a drug is safe, dangerous, or interacts "
                "with someone's medications or conditions."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "member": {"type": "string", "description": "Family member: e.g. Baba, Ma, Self, Child, or a name/relation like 'my father'."},
                    "drug": {"type": "string", "description": "The medicine/drug name to check, e.g. ibuprofen."},
                    "dose": {"type": "string", "description": "Optional dose, e.g. '400mg'."},
                },
                "required": ["member", "drug"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_family_health_overview",
            "description": (
                "Get the real health records (conditions, medications, allergies, risk flags) for "
                "ALL family members. Call this for questions about the whole family, e.g. 'is anyone sick?', "
                "'any serious issues in my family?', 'what does everyone take?'."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_member_health",
            "description": "Get the real health records for ONE specific family member.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member": {"type": "string", "description": "Family member: Baba, Ma, Self, Child, or a name/relation."},
                },
                "required": ["member"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assess_symptoms",
            "description": (
                "Triage symptoms a family member is currently experiencing (fever, pain, cough, etc.) "
                "to gauge urgency and give guidance."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "member": {"type": "string", "description": "Who has the symptoms."},
                    "symptoms": {"type": "string", "description": "Description of the symptoms, including numbers like temperature if given."},
                },
                "required": ["member", "symptoms"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_medical_info",
            "description": (
                "Look up general medical knowledge that is NOT specific to this family — e.g. "
                "'what is dengue?', 'how does warfarin work?', 'symptoms of diabetes'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The medical topic or question."},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_household_patterns",
            "description": "Detect health patterns/clusters across the household (e.g. several members with fever = possible outbreak).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "prepare_medication_change",
            "description": (
                "Prepare to ADD or REMOVE a medication for a family member. This does NOT save immediately — "
                "it asks the user to confirm first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "member": {"type": "string"},
                    "drug": {"type": "string"},
                    "dose": {"type": "string", "description": "Optional dose."},
                    "action": {"type": "string", "enum": ["add", "remove"]},
                },
                "required": ["member", "drug", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "prepare_log_symptom",
            "description": "Prepare to record a symptom for a family member (asks the user to confirm first).",
            "parameters": {
                "type": "object",
                "properties": {
                    "member": {"type": "string"},
                    "symptom": {"type": "string"},
                },
                "required": ["member", "symptom"],
            },
        },
    },
]

# Tools whose result is a complete verdict/confirmation envelope returned as-is.
_TERMINAL_TOOLS = {
    "check_drug_safety", "assess_symptoms", "check_household_patterns",
    "prepare_medication_change", "prepare_log_symptom",
}


# ── Tool dispatch ────────────────────────────────────────────────────────────
def _dispatch(name: str, args: dict, db: Session, household_id: int, language: str):
    """Return (result, is_terminal). Terminal → result is a full envelope dict."""
    if name == "check_drug_safety":
        env = run_safety_check(db, household_id, args.get("member", ""), args.get("drug", ""),
                               dose=args.get("dose"), language=language)
        return env, True

    if name == "assess_symptoms":
        env = run_triage(db, household_id, args.get("member", ""), args.get("symptoms", ""), language=language)
        return env, True

    if name == "check_household_patterns":
        env = run_pattern_check(db, household_id, language, trigger_member=None)
        return env, True

    if name == "get_family_health_overview":
        return _family_context(db, household_id), False

    if name == "get_member_health":
        return _member_context(db, household_id, args.get("member", "")), False

    if name == "search_medical_info":
        ans = grounded_explain(args.get("query", ""))
        if ans.evidence is not None and ans.band != "LOW":
            return f"Verified source ({ans.evidence.source}): {ans.text}", False
        return ("No verified source in the medical corpus. Answer from general medical "
                "knowledge and clearly note it is general information."), False

    if name == "prepare_medication_change":
        env = _prepare_write(db, household_id, language, intent="UPDATE_MEDICATION",
                             member=args.get("member", ""), action=args.get("action", "add"),
                             entity=EntityInfo(type="medication", name=args.get("drug"), dose=args.get("dose")))
        return env, True

    if name == "prepare_log_symptom":
        env = _prepare_write(db, household_id, language, intent="LOG_SYMPTOM",
                             member=args.get("member", ""), action="add",
                             entity=EntityInfo(type="symptom", name=args.get("symptom")))
        return env, True

    return f"Unknown tool: {name}", False


def _prepare_write(db, household_id, language, intent, member, action, entity: EntityInfo) -> dict:
    """Build a confirm-before-commit envelope reusing the existing pending/confirm flow."""
    m = resolve_member(db, household_id, member)
    if not m:
        spoken = (f"'{member}' নামে কেউ নেই — কার জন্য?" if language == "bn"
                  else f"I couldn't find '{member}' — who is this for?")
        return _info_envelope(spoken, language, verdict="CLARIFY", title="Which member?")

    label = m.role_label
    nlu = NluResult(intent=intent, member=label, action=action, entity=entity,
                    language=language, confidence=1.0, needs_confirmation=True,
                    raw_transcript=None)
    pending_id = store_pending(nlu)

    name = entity.name or "item"
    dose = f" {entity.dose}" if entity.dose else ""
    verb = "remove" if action == "remove" else "add" if intent == "UPDATE_MEDICATION" else "log"
    if language == "bn":
        spoken = f"{label} এর জন্য {name}{dose} {('মুছবো' if action=='remove' else 'যোগ করবো')} — নিশ্চিত?"
    else:
        spoken = f"I'll {verb} {name}{dose} for {label} — confirm?"

    return {
        "verdict": "CLARIFY",
        "spoken": spoken,
        "display": {"title": "Confirm Action", "conflict": None, "alternative": None,
                    "detail": spoken, "member": label, "interpreted": None},
        "evidence": {"source": None, "confidence": None, "grounding_score": None},
        "actions": [{"type": "confirm_write", "label": "Confirm", "target": label, "pending_id": pending_id}],
        "member_focus": label,
        "language": language,
        "needs_confirmation": True,
        "pending_id": pending_id,
    }


# ── Envelope builders ────────────────────────────────────────────────────────
def _info_envelope(text: str, language: str, verdict: str = "INFO",
                   title: str = "HealthTwin", source: Optional[str] = None) -> dict:
    return {
        "verdict": verdict,
        "spoken": text,
        "display": {"title": title, "conflict": None, "alternative": None,
                    "detail": text, "member": None, "interpreted": None,
                    "members": []},
        "evidence": {"source": source, "confidence": "LOW" if source else None,
                     "grounding_score": None},
        "actions": [],
        "member_focus": None,
        "language": language,
    }


# ── Main entry ───────────────────────────────────────────────────────────────
def run_brain(db: Session, household_id: int, user_message: str, language: str,
              history: Optional[list[dict]] = None) -> dict:
    """
    history: list of {"role": "user"|"assistant", "content": str} oldest→newest.
    """
    if not groq_pool.has_keys():
        return _info_envelope(
            "AI is not configured (missing API key). Please set GROQ_API_KEY.",
            language, verdict="REFUSE", title="Not Configured")

    lang_name = "Bengali" if language == "bn" else "English"
    roster = _roster(db, household_id)
    system = (
        f"You are HealthTwin, an intelligent family health assistant.\n\n"
        f"FAMILY MEMBERS: {roster}\n"
        "(Their detailed records — medications, conditions, allergies — come from your tools, not memory.)\n\n"
        "HOW YOU WORK:\n"
        "- You have tools that read the family's REAL records and a verified drug-safety engine. Use them for anything factual.\n"
        "- NEVER invent medications, doses, conditions, or lab values. If unsure, call a tool or say you don't know.\n"
        "- For whether a drug is safe/dangerous for someone, you MUST call check_drug_safety.\n"
        "- Whole-family health questions → get_family_health_overview. One person → get_member_health.\n"
        "- Symptoms someone has now → assess_symptoms. General medical facts → search_medical_info.\n"
        "- To add/remove a medication or log a symptom, call the matching prepare_ tool (it confirms before saving).\n"
        "- ALWAYS act on the user's LATEST message only. If it is just a greeting, thanks, or small talk "
        "(e.g. 'hello', 'hi', 'thanks', 'ok'), reply warmly in ONE short sentence and do NOT call any tool or "
        "list health data — even if earlier messages were about health. Prior turns are context, not a standing request.\n"
        f"- Always reply in {lang_name}. Be concise, specific, and warm.\n"
    )

    messages: list[dict] = [{"role": "system", "content": system}]
    if history:
        messages.extend(history[-20:])
    messages.append({"role": "user", "content": user_message})

    client = groq_pool.get_client()

    try:
        first = _chat(
            client, messages=messages, tools=TOOLS,
            tool_choice="auto", temperature=0.3, max_tokens=500,
        )
    except AllModelsRateLimited:
        return _info_envelope(
            ("All AI models have hit today's free-tier token limit. This resets daily — "
             "or upgrade your Groq plan for higher limits. (This is a quota issue, not a bug.)")
            if language != "bn" else
            ("আজকের ফ্রি টোকেন সীমা শেষ হয়ে গেছে। এটি প্রতিদিন রিসেট হয় — "
             "অথবা Groq প্ল্যান আপগ্রেড করুন।"),
            language, verdict="REFUSE", title="Daily Limit Reached")
    except Exception:
        return _info_envelope(
            "I had trouble reaching the AI service. Please try again in a moment."
            if language != "bn" else "AI সেবায় সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।",
            language, verdict="REFUSE", title="Temporary Error")

    msg = first.choices[0].message
    tool_calls = msg.tool_calls or []

    # No tool → the model answered directly (greeting / chit-chat / general). Done in 1 call.
    if not tool_calls:
        text = (msg.content or "").strip() or (
            "How can I help with your family's health today?"
            if language != "bn" else "আপনার পরিবারের স্বাস্থ্য নিয়ে কীভাবে সাহায্য করতে পারি?")
        return _info_envelope(text, language)

    # Execute tools. A terminal tool short-circuits with its own envelope.
    data_snippets: list[tuple[str, str]] = []
    assistant_turn = {"role": "assistant", "content": msg.content or "",
                      "tool_calls": [
                          {"id": tc.id, "type": "function",
                           "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                          for tc in tool_calls]}
    tool_results: list[dict] = []

    for tc in tool_calls:
        try:
            args = json.loads(tc.function.arguments or "{}")
        except json.JSONDecodeError:
            args = {}
        result, terminal = _dispatch(tc.function.name, args, db, household_id, language)
        if terminal:
            return result  # full envelope (verdict card / confirmation)
        data_snippets.append((tc.function.name, str(result)))
        tool_results.append({"role": "tool", "tool_call_id": tc.id, "content": str(result)})

    # Data tools ran → second call composes the final answer from the real data.
    messages.append(assistant_turn)
    messages.extend(tool_results)
    try:
        second = _chat(client, messages=messages, temperature=0.3, max_tokens=500)
        final_text = (second.choices[0].message.content or "").strip()
    except Exception:
        final_text = ""

    if not final_text:
        # Fallback: surface the raw data rather than failing.
        final_text = "\n".join(s for _, s in data_snippets)

    disc = _DISCLAIMER_BN if language == "bn" else _DISCLAIMER_EN
    if disc not in final_text:
        final_text = f"{final_text}\n\n{disc}".strip()

    return _info_envelope(final_text, language, source="HealthTwin records + AI")
