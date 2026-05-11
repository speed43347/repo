from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List
import os, uuid
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/groups", tags=["groups"])
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "chat")


def _group_out(g, db):
    members = db.query(models.GroupMember).filter_by(group_id=g.id).all()
    return schemas.GroupOut(
        id=g.id, name=g.name, owner_id=g.owner_id,
        avatar_url=g.avatar_url, avatar_color=g.avatar_color,
        created_at=g.created_at, member_count=len(members),
        members=[schemas.UserOut.model_validate(m.user) for m in members],
    )


@router.get("/", response_model=List[schemas.GroupOut])
def list_groups(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    member_ids = {m.group_id for m in db.query(models.GroupMember).filter_by(user_id=current_user.id).all()}
    owned_ids = {g.id for g in db.query(models.Group).filter_by(owner_id=current_user.id).all()}
    all_ids = member_ids | owned_ids
    groups = db.query(models.Group).filter(models.Group.id.in_(all_ids)).all()
    return [_group_out(g, db) for g in groups]


@router.post("/", response_model=schemas.GroupOut)
def create_group(
    name: str = Form(...),
    member_ids: str = Form(""),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = models.Group(name=name.strip(), owner_id=current_user.id, avatar_color=current_user.avatar_color or "#6366f1")
    db.add(group)
    db.commit()
    db.refresh(group)

    db.add(models.GroupMember(group_id=group.id, user_id=current_user.id))
    for uid_str in member_ids.split(','):
        uid_str = uid_str.strip()
        if uid_str.isdigit():
            uid = int(uid_str)
            if uid != current_user.id:
                db.add(models.GroupMember(group_id=group.id, user_id=uid))
    db.commit()
    return _group_out(group, db)


@router.get("/{group_id}", response_model=schemas.GroupOut)
def get_group(group_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    g = db.query(models.Group).filter_by(id=group_id).first()
    if not g:
        raise HTTPException(404)
    return _group_out(g, db)


@router.get("/{group_id}/messages", response_model=List[schemas.GroupMessageOut])
def get_messages(group_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.query(models.GroupMember).filter_by(group_id=group_id, user_id=current_user.id).first():
        raise HTTPException(403)
    msgs = db.query(models.GroupMessage).filter_by(group_id=group_id).order_by(models.GroupMessage.created_at).all()
    return [schemas.GroupMessageOut(
        id=m.id, group_id=m.group_id, content=m.content,
        message_type=m.message_type, file_url=m.file_url, file_name=m.file_name,
        file_size=m.file_size, duration=m.duration, sender_id=m.sender_id,
        created_at=m.created_at, sender=m.sender,
    ) for m in msgs]


@router.post("/{group_id}/upload")
async def upload_file(group_id: int, file: UploadFile = File(...), current_user=Depends(get_current_user)):
    data = await file.read()
    if len(data) > 100 * 1024 * 1024:
        raise HTTPException(400, "File too large")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "file")[1].lower()
    fname = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
        f.write(data)
    ct = file.content_type or ""
    msg_type = "image" if ct.startswith("image/") else "video" if ct.startswith("video/") else "audio" if ct.startswith("audio/") else "file"
    return {"file_url": f"/uploads/chat/{fname}", "file_name": file.filename, "file_size": len(data), "message_type": msg_type}
