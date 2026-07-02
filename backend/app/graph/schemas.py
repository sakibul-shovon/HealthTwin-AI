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
