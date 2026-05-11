from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class UserRegister(BaseModel):
    username: str
    display_name: str
    email: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    display_name: Optional[str]
    email: str
    avatar_url: Optional[str]
    avatar_color: str
    is_online: bool
    last_seen: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class MessageOut(BaseModel):
    id: int
    content: Optional[str]
    message_type: str
    file_url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    duration: Optional[float]
    sender_id: int
    receiver_id: int
    created_at: datetime
    is_read: bool
    sender: UserOut

    class Config:
        from_attributes = True


class GroupOut(BaseModel):
    id: int
    name: str
    owner_id: int
    avatar_url: Optional[str]
    avatar_color: str
    created_at: datetime
    member_count: int = 0
    members: List["UserOut"] = []

    class Config:
        from_attributes = True


class GroupMessageOut(BaseModel):
    id: int
    group_id: int
    content: Optional[str]
    message_type: str
    file_url: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    duration: Optional[float]
    sender_id: int
    created_at: datetime
    sender: "UserOut"

    class Config:
        from_attributes = True


class ChannelOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    avatar_url: Optional[str]
    avatar_color: str
    created_at: datetime
    subscriber_count: int = 0
    is_subscribed: bool = False

    class Config:
        from_attributes = True


class PostCommentOut(BaseModel):
    id: int
    post_id: int
    content: str
    created_at: datetime
    author: UserOut

    class Config:
        from_attributes = True


class PostOut(BaseModel):
    id: int
    channel_id: int
    content: Optional[str]
    file_url: Optional[str]
    file_type: Optional[str]
    file_name: Optional[str]
    file_size: Optional[int]
    views: int
    reposts: int
    created_at: datetime
    author: UserOut
    comment_count: int = 0

    class Config:
        from_attributes = True
