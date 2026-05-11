from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
import os, uuid
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/wallpaper", tags=["wallpaper"])

WALLPAPER_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "wallpapers")


def pair_name(a: int, b: int) -> str:
    return f"{min(a, b)}_{max(a, b)}"


@router.get("/{peer_id}")
def get_wallpaper(peer_id: int, current_user=Depends(get_current_user)):
    name = pair_name(current_user.id, peer_id)
    os.makedirs(WALLPAPER_DIR, exist_ok=True)
    for fname in os.listdir(WALLPAPER_DIR):
        if fname.startswith(name + "."):
            return {"url": f"/uploads/wallpapers/{fname}"}
    return {"url": None}


@router.post("/{peer_id}")
async def set_wallpaper(
    peer_id: int,
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    os.makedirs(WALLPAPER_DIR, exist_ok=True)

    # Remove old wallpaper for this pair
    name = pair_name(current_user.id, peer_id)
    for old in os.listdir(WALLPAPER_DIR):
        if old.startswith(name + "."):
            os.remove(os.path.join(WALLPAPER_DIR, old))

    ext = os.path.splitext(file.filename or "bg")[1].lower() or ".jpg"
    fname = f"{name}{ext}"
    with open(os.path.join(WALLPAPER_DIR, fname), "wb") as f:
        f.write(content)

    return {"url": f"/uploads/wallpapers/{fname}"}


@router.delete("/{peer_id}")
def delete_wallpaper(peer_id: int, current_user=Depends(get_current_user)):
    name = pair_name(current_user.id, peer_id)
    os.makedirs(WALLPAPER_DIR, exist_ok=True)
    for fname in os.listdir(WALLPAPER_DIR):
        if fname.startswith(name + "."):
            os.remove(os.path.join(WALLPAPER_DIR, fname))
    return {"ok": True}
