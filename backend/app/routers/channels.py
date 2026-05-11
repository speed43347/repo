from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import os, uuid
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user

router = APIRouter(prefix="/api/channels", tags=["channels"])
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "chat")


def _sub_count(db, channel_id):
    return db.query(models.ChannelSubscription).filter_by(channel_id=channel_id).count()


def _is_sub(db, channel_id, user_id):
    return db.query(models.ChannelSubscription).filter_by(channel_id=channel_id, user_id=user_id).first() is not None


def _channel_out(c, db, user_id):
    return schemas.ChannelOut(
        id=c.id, name=c.name, description=c.description,
        owner_id=c.owner_id, avatar_url=c.avatar_url,
        avatar_color=c.avatar_color, created_at=c.created_at,
        subscriber_count=_sub_count(db, c.id),
        is_subscribed=(c.owner_id == user_id or _is_sub(db, c.id, user_id)),
    )


@router.get("/", response_model=List[schemas.ChannelOut])
def list_channels(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    owned_ids = {c.id for c in db.query(models.Channel).filter_by(owner_id=current_user.id).all()}
    sub_ids = {s.channel_id for s in db.query(models.ChannelSubscription).filter_by(user_id=current_user.id).all()}
    all_ids = owned_ids | sub_ids
    channels = db.query(models.Channel).filter(models.Channel.id.in_(all_ids)).all()
    return [_channel_out(c, db, current_user.id) for c in channels]


@router.post("/", response_model=schemas.ChannelOut)
async def create_channel(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    avatar: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    channel = models.Channel(
        name=name, description=description,
        owner_id=current_user.id,
        avatar_color=current_user.avatar_color or "#6366f1",
    )
    if avatar and avatar.filename:
        content = await avatar.read()
        ext = os.path.splitext(avatar.filename)[1].lower() or ".jpg"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        fname = f"ch_{uuid.uuid4().hex[:8]}{ext}"
        with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
            f.write(content)
        channel.avatar_url = f"/uploads/chat/{fname}"
    db.add(channel)
    db.commit()
    db.refresh(channel)
    return _channel_out(channel, db, current_user.id)


@router.get("/{channel_id}", response_model=schemas.ChannelOut)
def get_channel(channel_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(models.Channel).filter_by(id=channel_id).first()
    if not c:
        raise HTTPException(404)
    return _channel_out(c, db, current_user.id)


@router.post("/{channel_id}/subscribe")
def subscribe(channel_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if not db.query(models.Channel).filter_by(id=channel_id).first():
        raise HTTPException(404)
    if not _is_sub(db, channel_id, current_user.id):
        db.add(models.ChannelSubscription(channel_id=channel_id, user_id=current_user.id))
        db.commit()
    return {"ok": True}


@router.delete("/{channel_id}/subscribe")
def unsubscribe(channel_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    sub = db.query(models.ChannelSubscription).filter_by(channel_id=channel_id, user_id=current_user.id).first()
    if sub:
        db.delete(sub)
        db.commit()
    return {"ok": True}


@router.get("/{channel_id}/posts", response_model=List[schemas.PostOut])
def get_posts(channel_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    posts = (db.query(models.Post)
             .filter_by(channel_id=channel_id)
             .order_by(models.Post.created_at.asc())
             .all())
    result = []
    for p in posts:
        # Only count view once per user per post
        already = db.query(models.PostView).filter_by(post_id=p.id, user_id=current_user.id).first()
        if not already:
            p.views += 1
            db.add(models.PostView(post_id=p.id, user_id=current_user.id))
            db.commit()
        cc = db.query(models.PostComment).filter_by(post_id=p.id).count()
        result.append(schemas.PostOut(
            id=p.id, channel_id=p.channel_id, content=p.content,
            file_url=p.file_url, file_type=p.file_type, file_name=p.file_name,
            file_size=p.file_size, views=p.views, reposts=p.reposts,
            created_at=p.created_at, author=p.author, comment_count=cc,
        ))
    return result


@router.post("/{channel_id}/posts", response_model=schemas.PostOut)
async def create_post(
    channel_id: int,
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.query(models.Channel).filter_by(id=channel_id).first()
    if not c or c.owner_id != current_user.id:
        raise HTTPException(403, "Only owner can post")

    file_url = file_type = file_name = None
    file_size = None
    if file and file.filename:
        data = await file.read()
        file_size = len(data)
        ext = os.path.splitext(file.filename)[1].lower()
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        fname = f"{uuid.uuid4().hex}{ext}"
        with open(os.path.join(UPLOAD_DIR, fname), "wb") as f_:
            f_.write(data)
        file_url = f"/uploads/chat/{fname}"
        file_name = file.filename
        ct = file.content_type or ""
        file_type = "image" if ct.startswith("image/") else "video" if ct.startswith("video/") else "file"

    post = models.Post(
        channel_id=channel_id, author_id=current_user.id,
        content=content or None, file_url=file_url, file_type=file_type,
        file_name=file_name, file_size=file_size,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return schemas.PostOut(
        id=post.id, channel_id=post.channel_id, content=post.content,
        file_url=post.file_url, file_type=post.file_type, file_name=post.file_name,
        file_size=post.file_size, views=0, reposts=0,
        created_at=post.created_at, author=post.author, comment_count=0,
    )


@router.post("/{channel_id}/posts/{post_id}/repost")
def repost(channel_id: int, post_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    post = db.query(models.Post).filter_by(id=post_id, channel_id=channel_id).first()
    if not post:
        raise HTTPException(404)
    post.reposts += 1
    db.commit()
    return {"reposts": post.reposts}


@router.get("/{channel_id}/posts/{post_id}/comments", response_model=List[schemas.PostCommentOut])
def get_comments(channel_id: int, post_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    comments = (db.query(models.PostComment)
                .filter_by(post_id=post_id)
                .order_by(models.PostComment.created_at)
                .all())
    return [schemas.PostCommentOut(
        id=c.id, post_id=c.post_id, content=c.content,
        created_at=c.created_at, author=c.author,
    ) for c in comments]


@router.post("/{channel_id}/posts/{post_id}/comments", response_model=schemas.PostCommentOut)
def add_comment(
    channel_id: int, post_id: int,
    content: str = Form(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(models.Post).filter_by(id=post_id).first()
    if not post:
        raise HTTPException(404)
    c = models.PostComment(post_id=post_id, author_id=current_user.id, content=content)
    db.add(c)
    db.commit()
    db.refresh(c)
    return schemas.PostCommentOut(
        id=c.id, post_id=c.post_id, content=c.content,
        created_at=c.created_at, author=c.author,
    )
