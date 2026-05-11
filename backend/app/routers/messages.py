from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
import os, uuid
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "chat")
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


@router.get("/{user_id}", response_model=List[schemas.MessageOut])
def get_conversation(user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    messages = (
        db.query(models.Message)
        .filter(
            or_(
                and_(models.Message.sender_id == current_user.id, models.Message.receiver_id == user_id),
                and_(models.Message.sender_id == user_id, models.Message.receiver_id == current_user.id),
            )
        )
        .order_by(models.Message.created_at.asc())
        .all()
    )
    for m in messages:
        if m.receiver_id == current_user.id and not m.is_read:
            m.is_read = True
    db.commit()
    return messages


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="File too large (max 100MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1].lower()
    fname = f"{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)

    with open(fpath, "wb") as f:
        f.write(content)

    ct = file.content_type or ""
    if ct.startswith("image/"):
        msg_type = "image"
    elif ct.startswith("video/"):
        msg_type = "video"
    elif ct.startswith("audio/"):
        msg_type = "audio"
    else:
        msg_type = "file"

    return {
        "file_url": f"/uploads/chat/{fname}",
        "file_name": file.filename,
        "file_size": len(content),
        "message_type": msg_type,
    }
