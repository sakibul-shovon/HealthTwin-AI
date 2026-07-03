from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from .models import RelationshipType

# Schema for flags used in MemberProfileSchema
class MemberFlagsSchema(BaseModel):
    kidney_impaired: bool
    liver_impaired: bool
    pregnant: bool

class MedicationBase(BaseModel):
    name: str
    dose: str

class MedicationSchema(MedicationBase):
    id: int
    since_date: Optional[str] = None
    added_by_member_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class ConditionBase(BaseModel):
    name: str

class ConditionSchema(ConditionBase):
    id: int
    since_date: Optional[str] = None
    
    class Config:
        from_attributes = True

class AllergyBase(BaseModel):
    substance: str
    reaction: Optional[str] = None

class AllergySchema(AllergyBase):
    id: int
    
    class Config:
        from_attributes = True

class SymptomLogSchema(BaseModel):
    id: int
    symptom: str
    severity: Optional[str] = None
    logged_at: datetime
    logged_by_member_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class ReminderSchema(BaseModel):
    id: int
    medication_id: Optional[int] = None
    time: str
    repeat_rule: str
    active: bool
    
    class Config:
        from_attributes = True

class RelationshipSchema(BaseModel):
    id: int
    from_member_id: int
    to_member_id: int
    type: RelationshipType
    caregiver: bool
    
    class Config:
        from_attributes = True

# Full Member Schema
class MemberSchema(BaseModel):
    id: int
    household_id: int
    display_name: str
    role_label: str
    age: int
    sex: str
    weight_kg: Optional[float] = None
    kidney_impaired: bool
    liver_impaired: bool
    pregnant: bool
    created_at: datetime
    
    conditions: List[ConditionSchema] = []
    medications: List[MedicationSchema] = []
    allergies: List[AllergySchema] = []
    symptoms: List[SymptomLogSchema] = []
    reminders: List[ReminderSchema] = []
    
    class Config:
        from_attributes = True

class MemberCreateSchema(BaseModel):
    display_name: str
    role_label: str
    age: int = 0
    sex: str = "unknown"
    weight_kg: Optional[float] = None
    kidney_impaired: bool = False
    liver_impaired: bool = False
    pregnant: bool = False

class MemberUpdateSchema(BaseModel):
    display_name: Optional[str] = None
    role_label: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    weight_kg: Optional[float] = None
    kidney_impaired: Optional[bool] = None
    liver_impaired: Optional[bool] = None
    pregnant: Optional[bool] = None

# Compact Member Profile Schema used by Safety Spine (CRITICAL SHAPE)
class MemberProfileSchema(BaseModel):
    role_label: str
    age: int
    sex: str
    weight_kg: Optional[float] = None
    flags: MemberFlagsSchema
    medications: List[MedicationBase]
    conditions: List[str]
    allergies: List[AllergyBase]
    
    class Config:
        from_attributes = True

# Full Household Schema
class HouseholdSchema(BaseModel):
    id: int
    name: str
    created_at: datetime
    members: List[MemberSchema] = []
    relationships: List[RelationshipSchema] = []
    
    class Config:
        from_attributes = True

class ChatMessageSchema(BaseModel):
    id: int
    household_id: int
    role: str
    text: str
    envelope: Optional[Dict] = None
    intent: Optional[str] = None
    member_focus: Optional[str] = None
    language: str = "en"
    created_at: datetime
    
    class Config:
        from_attributes = True

class MemberTwinSchema(BaseModel):
    member: str
    age: int
    sex: str
    risk_score: float
    risk_band: str
    risk_factors: List[str]
    ai_summary: str
    medications: List[str]
    conditions: List[str]
    allergies: List[str]
    flags: List[str]
    caregiver: Optional[str]
    reminders: List[Dict]
    recent_alerts: List[Dict]

    class Config:
        from_attributes = True

class HealthEventSchema(BaseModel):
    id: int
    member_id: int
    event_type: str
    detail: Optional[Dict] = None
    created_at: datetime

    class Config:
        from_attributes = True
