import os
import json
import re
from typing import Optional
from pydantic import BaseModel, Field
from groq import Groq
from app.graph.database import SessionLocal
from app.graph.models import Household, Member
from app.config import Settings

settings = Settings()

class EntityInfo(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    dose: Optional[str] = None
    value: Optional[str] = None

class NluResult(BaseModel):
    intent: str
    member: Optional[str] = None
    action: Optional[str] = None
    entity: EntityInfo = Field(default_factory=EntityInfo)
    language: str
    confidence: float
    needs_confirmation: bool = False

def detect_bengali(text: str) -> bool:
    # Bengali unicode block: U+0980 - U+09FF
    return bool(re.search(r'[\u0980-\u09FF]', text))

def load_synonyms() -> dict:
    # Load synonyms
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    syn_file = os.path.join(data_dir, "drug_synonyms.json")
    if os.path.exists(syn_file):
        with open(syn_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def resolve_drug_name(drug: str, synonyms: dict) -> str:
    if not drug:
        return drug
    # synonyms.json is { alias: canonical }, e.g. "brufen": "ibuprofen"
    d = drug.lower().strip()
    return synonyms.get(d, d)

def parse_command(transcript: str, language_hint: Optional[str] = None) -> NluResult:
    is_bn = detect_bengali(transcript)
    detected_lang = "bn" if is_bn or language_hint == "bn" else "en"
    
    # Get active household (mocking household resolution to Rahman family for demo)
    db = SessionLocal()
    members_labels = []
    try:
        household = db.query(Household).filter(Household.name == "Rahman Family").first()
        if household:
            members = db.query(Member).filter(Member.household_id == household.id).all()
            members_labels = [m.role_label for m in members]
    finally:
        db.close()
        
    members_str = ", ".join(members_labels) if members_labels else "Baba, Ma, Self, Child"
    
    api_key = settings.GROQ_API_KEY
    if not api_key:
        # Fallback Mock for testing (no GROQ key)
        tl = transcript.lower()
        if "ibuprofen" in tl or "ওষুধ" in transcript:
            return NluResult(
                intent="DRUG_SAFETY_CHECK",
                member="Baba" if ("baba" in tl or "বাবা" in transcript) else "Self",
                language=detected_lang,
                confidence=0.9,
                entity=EntityInfo(type="medication", name="ibuprofen"),
            )
        # Generic medication-write pattern: "add X to/for Y" or drug name in known list
        _MOCK_DRUGS = {
            "losartan": ("Ma", "losartan", "50mg"),
            "metformin": ("Ma", "metformin", "500mg"),
            "aspirin": ("Baba", "aspirin", "100mg"),
            "paracetamol": ("Baba", "paracetamol", "500mg"),
        }
        for drug, (default_member, drug_name, default_dose) in _MOCK_DRUGS.items():
            if drug in tl:
                # Resolve member from transcript if mentioned
                member_label = default_member
                for alias, label in [("baba", "Baba"), ("ma", "Ma"), ("self", "Self"), ("child", "Child")]:
                    if alias in tl:
                        member_label = label
                        break
                return NluResult(
                    intent="UPDATE_MEDICATION",
                    member=member_label,
                    language=detected_lang,
                    confidence=0.9,
                    needs_confirmation=True,
                    action="add",
                    entity=EntityInfo(type="medication", name=drug_name, dose=default_dose),
                )
        return NluResult(intent="UNKNOWN", language=detected_lang, confidence=0.0)

    # Real LLM call
    client = Groq(api_key=api_key)
    
    system_prompt = f"""You convert a caregiver's spoken health request into a structured command.
Output ONLY valid JSON matching this schema exactly:
{{
  "intent": "<one of the closed set>",
  "member": "<role_label resolved against graph, or null>",
  "action": "add | update | remove | null",
  "entity": {{
    "type": "medication | condition | allergy | symptom | member | reminder | caregiver | null",
    "name": "<string or null>",
    "dose": "<string or null>",
    "value": "<string or null>"
  }},
  "language": "bn | en",
  "confidence": <float 0..1>,
  "needs_confirmation": <bool>
}}

CLOSED INTENT SET: ADD_MEMBER, UPDATE_MEMBER, UPDATE_MEDICATION, LOG_SYMPTOM, DRUG_SAFETY_CHECK, TRIAGE_CHECK, HOUSEHOLD_STATUS, PATTERN_CHECK, SET_REMINDER, ASSIGN_CAREGIVER, GENERAL_HEALTH_Q, UNKNOWN.
Write intents (ADD_MEMBER, UPDATE_MEMBER, UPDATE_MEDICATION, LOG_SYMPTOM, SET_REMINDER, ASSIGN_CAREGIVER) MUST have needs_confirmation: true.
Valid members in this household: {members_str}. Resolve 'my', 'I' to 'Self'. Resolve names to the valid members.
Ensure valid JSON output ONLY.
"""
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": transcript}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0,
            response_format={"type": "json_object"}
        )
        out_text = response.choices[0].message.content
        parsed = json.loads(out_text)
        
        # Validation & Cleanup
        intent = parsed.get("intent", "UNKNOWN")
        valid_intents = ["ADD_MEMBER", "UPDATE_MEMBER", "UPDATE_MEDICATION", "LOG_SYMPTOM", "DRUG_SAFETY_CHECK", 
                         "TRIAGE_CHECK", "HOUSEHOLD_STATUS", "PATTERN_CHECK", "SET_REMINDER", "ASSIGN_CAREGIVER", 
                         "GENERAL_HEALTH_Q", "UNKNOWN"]
        if intent not in valid_intents:
            intent = "UNKNOWN"
            
        write_intents = ["ADD_MEMBER", "UPDATE_MEMBER", "UPDATE_MEDICATION", "LOG_SYMPTOM", "SET_REMINDER", "ASSIGN_CAREGIVER"]
        needs_conf = True if intent in write_intents else False
        
        ent = parsed.get("entity", {})
        synonyms = load_synonyms()
        if ent and ent.get("name") and ent.get("type") == "medication":
            ent["name"] = resolve_drug_name(ent["name"], synonyms)
            
        return NluResult(
            intent=intent,
            member=parsed.get("member"),
            action=parsed.get("action"),
            entity=EntityInfo(
                type=ent.get("type"),
                name=ent.get("name"),
                dose=ent.get("dose"),
                value=ent.get("value")
            ),
            language=detected_lang,
            confidence=float(parsed.get("confidence", 0.9)),
            needs_confirmation=needs_conf
        )
    except Exception as e:
        return NluResult(intent="UNKNOWN", language=detected_lang, confidence=0.0)
