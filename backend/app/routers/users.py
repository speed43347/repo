from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os, uuid, shutil
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user
from ..ws_manager import manager

router = APIRouter(prefix="/api/users", tags=["users"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "avatars")
MAX_AVATAR_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=schemas.UserOut)
def update_profile(data: schemas.UserUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if data.username and data.username != current_user.username:
        if db.query(models.User).filter(models.User.username == data.username).first():
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = data.username
    if data.email and data.email != current_user.email:
        if db.query(models.User).filter(models.User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = data.email
    if data.display_name is not None:
        current_user.display_name = data.display_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar", response_model=schemas.UserOut)
async def upload_avatar(file: UploadFile = File(...), current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    allowed = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    fname = f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)

    with open(fpath, "wb") as f:
        f.write(content)

    current_user.avatar_url = f"/uploads/avatars/{fname}"
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/", response_model=List[schemas.UserOut])
def get_users(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.id != current_user.id).all()
    online_ids = set(manager.online_ids())
    for u in users:
        u.is_online = u.id in online_ids
    return users
