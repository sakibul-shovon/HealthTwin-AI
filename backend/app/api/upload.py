import uuid
import time
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.graph.database import get_db
from app.graph import models, crud
from app.multimodal.extract import extract
from app.spine.doc_retrieval import embed_and_store_document
from app.voice.pending import _LOCK, _load, _save, _evict_expired, MAX_ENTRIES, TTL_SECONDS
from pydantic import BaseModel

router = APIRouter()

def store_upload_pending(extracted: dict, member_id: int, kind: str, filename: str) -> str:
    pending_id = str(uuid.uuid4())
    with _LOCK:
        store = _load()
        _evict_expired(store)
        if len(store) >= MAX_ENTRIES:
            oldest = min(store, key=lambda k: store[k].get("expiry", 0))
            del store[oldest]
        store[pending_id] = {
            "type": "upload",
            "extracted": extracted,
            "member_id": member_id,
            "kind": kind,
            "filename": filename,
            "expiry": time.time() + TTL_SECONDS
        }
        _save(store)
    return pending_id

def retrieve_upload_pending(pending_id: str) -> dict:
    with _LOCK:
        store = _load()
        entry = store.get(pending_id)
        if entry is None or entry.get("type") != "upload":
            return None
        if time.time() > entry.get("expiry", 0):
            del store[pending_id]
            _save(store)
            return None
        return entry

def clear_pending(pending_id: str) -> None:
    with _LOCK:
        store = _load()
        if pending_id in store:
            del store[pending_id]
            _save(store)

@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    member_id: int = Form(...),
    kind: str = Form("prescription"),
    db: Session = Depends(get_db)
):
    MAX_SIZE = 5 * 1024 * 1024 # 5MB
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large")
        
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type")
        
    # Extract entities
    extracted = extract(file_bytes, file.filename, kind)

    # A document is "medical" if it yielded at least one recognisable entity.
    is_medical = bool(
        extracted.get("medications") or
        extracted.get("conditions") or
        extracted.get("lab_values")
    )

    # Store pending
    pending_id = store_upload_pending(extracted, member_id, kind, file.filename)

    return {
        "pending_id": pending_id,
        "filename": file.filename,
        "extracted": extracted,
        "is_medical": is_medical,
    }

from typing import Optional

class UploadConfirmRequest(BaseModel):
    pending_id: str
    edits: Optional[dict] = None # Optional user edits to the extracted data

@router.post("/confirm")
def confirm_upload(
    req: UploadConfirmRequest,
    db: Session = Depends(get_db)
):
    pending = retrieve_upload_pending(req.pending_id)
    if not pending:
        raise HTTPException(status_code=404, detail="Pending upload not found or expired")
        
    member_id = pending["member_id"]
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    extracted = pending["extracted"]
    
    # Apply edits if any
    if req.edits:
        if "medications" in req.edits:
            extracted["medications"] = req.edits["medications"]
        if "conditions" in req.edits:
            extracted["conditions"] = req.edits["conditions"]
            
    # Write to DB
    # 1. Add Document record — skip if exact same filename+kind already uploaded
    existing_doc = db.query(models.Document).filter(
        models.Document.member_id == member_id,
        models.Document.filename == pending["filename"],
        models.Document.kind == pending["kind"],
    ).first()
    if existing_doc:
        clear_pending(req.pending_id)
        return {
            "status": "already_exists",
            "household_refresh": False,
            "document_id": existing_doc.id,
            "summary": f"'{pending['filename']}' was already uploaded for this member — no changes made.",
        }

    doc = models.Document(
        member_id=member_id,
        household_id=member.household_id,
        kind=pending["kind"],
        filename=pending["filename"],
        extracted=extracted
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    # 1.5 Embed and store document text chunks — only for medical documents.
    # Non-medical PDFs (research papers, receipts, etc.) must not pollute the RAG store.
    is_medical = bool(
        extracted.get("medications") or
        extracted.get("conditions") or
        extracted.get("lab_values")
    )
    if extracted.get("raw_text") and is_medical:
        embed_and_store_document(db, doc.id, member_id, extracted["raw_text"])
    
    # 2. Add medications and conditions
    for med in extracted.get("medications", []):
        crud.add_medication(db, member_id, med["name"], med.get("dose", "—"))
        
    for cond in extracted.get("conditions", []):
        crud.add_condition(db, member_id, cond)
        
    # 3. Log event
    from app.memory.events import log_event
    log_event(db, member_id, "document_uploaded", {
        "filename": pending["filename"],
        "kind": pending["kind"],
        "document_id": doc.id
    })
    
    # Clean up pending
    clear_pending(req.pending_id)
    
    return {
        "status": "success",
        "household_refresh": True,
        "document_id": doc.id
    }
