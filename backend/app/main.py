from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import json, os
from datetime import datetime

from .database import engine, get_db
from . import models
from .auth import SECRET_KEY, ALGORITHM
from .ws_manager import manager
from .routers import auth, users, messages, wallpapers, channels, groups

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Repa API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(messages.router)
app.include_router(wallpapers.router)
app.include_router(channels.router)
app.include_router(groups.router)


def serialize_user(u: models.User, online_ids=None) -> dict:
    is_online = (online_ids is not None and u.id in online_ids) or u.is_online
    return {
        "id": u.id,
        "username": u.username,
        "display_name": u.display_name,
        "email": u.email,
        "avatar_url": u.avatar_url,
        "avatar_color": u.avatar_color,
        "is_online": is_online,
        "last_seen": u.last_seen.isoformat() if u.last_seen else None,
        "created_at": u.created_at.isoformat(),
    }


def serialize_message(msg: models.Message, online_ids=None) -> dict:
    return {
        "id": msg.id,
        "content": msg.content,
        "message_type": msg.message_type,
        "file_url": msg.file_url,
        "file_name": msg.file_name,
        "file_size": msg.file_size,
        "duration": msg.duration,
        "sender_id": msg.sender_id,
        "receiver_id": msg.receiver_id,
        "created_at": msg.created_at.isoformat(),
        "is_read": msg.is_read,
        "sender": serialize_user(msg.sender, online_ids),
    }


@app.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    try:
        from jose import jwt
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            await ws.close(code=1008)
            return
    except Exception:
        await ws.close(code=1008)
        return

    await manager.connect(user_id, ws)
    user.is_online = True
    db.commit()

    online_ids = set(manager.online_ids())

    # Tell the new user who's currently online
    current_online = [uid for uid in online_ids if uid != user_id]
    await manager.send_to(user_id, {"type": "online_list", "user_ids": current_online})

    # Notify others this user came online
    for uid in online_ids:
        if uid != user_id:
            await manager.send_to(uid, {"type": "user_online", "user_id": user_id})

    try:
        while True:
            raw = await ws.receive_text()
            data = json.loads(raw)
            t = data.get("type")

            if t == "message":
                content = (data.get("content") or "").strip()
                receiver_id = data.get("receiver_id")
                msg_type = data.get("message_type", "text")
                file_url = data.get("file_url")
                file_name = data.get("file_name")
                file_size = data.get("file_size")
                duration = data.get("duration")

                if not receiver_id:
                    continue
                if msg_type == "text" and not content:
                    continue

                msg = models.Message(
                    content=content or None,
                    message_type=msg_type,
                    file_url=file_url,
                    file_name=file_name,
                    file_size=file_size,
                    duration=duration,
                    sender_id=user_id,
                    receiver_id=receiver_id,
                    created_at=datetime.utcnow(),
                )
                db.add(msg)
                db.commit()
                db.refresh(msg)

                payload_out = {"type": "message", "message": serialize_message(msg, set(manager.online_ids()))}
                await manager.send_to(user_id, payload_out)
                await manager.send_to(receiver_id, payload_out)

            elif t == "typing":
                receiver_id = data.get("receiver_id")
                if receiver_id:
                    await manager.send_to(receiver_id, {
                        "type": "typing",
                        "user_id": user_id,
                        "is_typing": data.get("is_typing", False),
                    })

            elif t == "live_type":
                receiver_id = data.get("receiver_id")
                if receiver_id:
                    await manager.send_to(receiver_id, {
                        "type": "live_type",
                        "user_id": user_id,
                        "text": data.get("text", ""),
                    })

            elif t == "wallpaper_set":
                receiver_id = data.get("receiver_id")
                url = data.get("url")
                if receiver_id and url:
                    await manager.send_to(receiver_id, {
                        "type": "wallpaper_set",
                        "from_user_id": user_id,
                        "url": url,
                    })

            elif t == "group_message":
                group_id = data.get("group_id")
                content = (data.get("content") or "").strip()
                msg_type = data.get("message_type", "text")
                file_url = data.get("file_url")
                file_name = data.get("file_name")
                file_size = data.get("file_size")
                duration = data.get("duration")
                if not group_id:
                    continue
                if msg_type == "text" and not content:
                    continue
                member = db.query(models.GroupMember).filter_by(group_id=group_id, user_id=user_id).first()
                if not member:
                    continue
                gm = models.GroupMessage(
                    group_id=group_id, sender_id=user_id,
                    content=content or None, message_type=msg_type,
                    file_url=file_url, file_name=file_name, file_size=file_size, duration=duration,
                    created_at=datetime.utcnow(),
                )
                db.add(gm)
                db.commit()
                db.refresh(gm)
                online = set(manager.online_ids())
                gm_payload = {"type": "group_message", "message": {
                    "id": gm.id, "group_id": gm.group_id, "content": gm.content,
                    "message_type": gm.message_type, "file_url": gm.file_url,
                    "file_name": gm.file_name, "file_size": gm.file_size, "duration": gm.duration,
                    "sender_id": gm.sender_id, "created_at": gm.created_at.isoformat(),
                    "sender": serialize_user(gm.sender, online),
                }}
                all_members = db.query(models.GroupMember).filter_by(group_id=group_id).all()
                for m in all_members:
                    await manager.send_to(m.user_id, gm_payload)

            elif t == "group_typing":
                group_id = data.get("group_id")
                if group_id:
                    all_members = db.query(models.GroupMember).filter_by(group_id=group_id).all()
                    for m in all_members:
                        if m.user_id != user_id:
                            await manager.send_to(m.user_id, {
                                "type": "group_typing",
                                "group_id": group_id,
                                "user_id": user_id,
                                "is_typing": data.get("is_typing", False),
                            })

            elif t == "group_live_type":
                group_id = data.get("group_id")
                if group_id:
                    all_members = db.query(models.GroupMember).filter_by(group_id=group_id).all()
                    for m in all_members:
                        if m.user_id != user_id:
                            await manager.send_to(m.user_id, {
                                "type": "group_live_type",
                                "group_id": group_id,
                                "user_id": user_id,
                                "text": data.get("text", ""),
                            })

            elif t == "read":
                sender_id = data.get("sender_id")
                if sender_id:
                    msgs = db.query(models.Message).filter(
                        models.Message.sender_id == sender_id,
                        models.Message.receiver_id == user_id,
                        models.Message.is_read == False,
                    ).all()
                    for m in msgs:
                        m.is_read = True
                    db.commit()
                    await manager.send_to(sender_id, {"type": "read", "by": user_id})

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id)
        user.is_online = False
        user.last_seen = datetime.utcnow()
        db.commit()
        for uid in manager.online_ids():
            await manager.send_to(uid, {
                "type": "user_offline",
                "user_id": user_id,
                "last_seen": user.last_seen.isoformat(),
            })


@app.get("/")
def root():
    return {"status": "ok", "app": "Repa"}
