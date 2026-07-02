from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, JSON, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from .database import Base

class RelationshipType(str, enum.Enum):
    parent_of = "parent_of"
    child_of = "child_of"
    spouse_of = "spouse_of"
    sibling_of = "sibling_of"

class Household(Base):
    __tablename__ = "households"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    members = relationship("Member", back_populates="household", cascade="all, delete-orphan")

class Member(Base):
    __tablename__ = "members"
    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id"), nullable=False)
    display_name = Column(String, nullable=False)
    role_label = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    sex = Column(String, nullable=False)
    weight_kg = Column(Float, nullable=True)
    kidney_impaired = Column(Boolean, default=False)
    liver_impaired = Column(Boolean, default=False)
    pregnant = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    household = relationship("Household", back_populates="members")
    conditions = relationship("Condition", back_populates="member", cascade="all, delete-orphan")
    medications = relationship("Medication", back_populates="member", cascade="all, delete-orphan", foreign_keys="[Medication.member_id]")
    allergies = relationship("Allergy", back_populates="member", cascade="all, delete-orphan")
    symptoms = relationship("SymptomLog", back_populates="member", cascade="all, delete-orphan", foreign_keys="[SymptomLog.member_id]")
    reminders = relationship("Reminder", back_populates="member", cascade="all, delete-orphan")
    
    # Relationships where this member is the source
    relationships_out = relationship(
        "Relationship", 
        foreign_keys="[Relationship.from_member_id]",
        back_populates="from_member",
        cascade="all, delete-orphan"
    )
    # Relationships where this member is the target
    relationships_in = relationship(
        "Relationship", 
        foreign_keys="[Relationship.to_member_id]",
        back_populates="to_member",
        cascade="all, delete-orphan"
    )

class Condition(Base):
    __tablename__ = "conditions"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    name = Column(String, nullable=False)
    since_date = Column(String, nullable=True)
    
    member = relationship("Member", back_populates="conditions")

class Medication(Base):
    __tablename__ = "medications"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    name = Column(String, nullable=False)
    dose = Column(String, nullable=False)
    since_date = Column(String, nullable=True)
    added_by_member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    
    member = relationship("Member", back_populates="medications", foreign_keys=[member_id])

class Allergy(Base):
    __tablename__ = "allergies"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    substance = Column(String, nullable=False)
    reaction = Column(String, nullable=True)
    
    member = relationship("Member", back_populates="allergies")

class SymptomLog(Base):
    __tablename__ = "symptom_logs"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    symptom = Column(String, nullable=False)
    severity = Column(String, nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)
    logged_by_member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    
    member = relationship("Member", back_populates="symptoms", foreign_keys=[member_id])

class Relationship(Base):
    __tablename__ = "relationships"
    id = Column(Integer, primary_key=True, index=True)
    from_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    to_member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    type = Column(SAEnum(RelationshipType), nullable=False)
    caregiver = Column(Boolean, default=False)
    
    from_member = relationship("Member", foreign_keys=[from_member_id], back_populates="relationships_out")
    to_member = relationship("Member", foreign_keys=[to_member_id], back_populates="relationships_in")

class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=True)
    time = Column(String, nullable=False)
    repeat_rule = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    
    member = relationship("Member", back_populates="reminders")

class AgentTrace(Base):
    __tablename__ = "agent_traces"
    id = Column(Integer, primary_key=True, index=True)
    intent = Column(String, nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True)
    gates_passed = Column(JSON, nullable=True)
    grounding_score = Column(Float, nullable=True)
    source_cited = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class KBChunk(Base):
    __tablename__ = "kb_chunks"
    id = Column(String, primary_key=True)
    text = Column(String, nullable=False)
    source = Column(String, nullable=False)
    url = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    embedding = Column(JSON, nullable=True)
