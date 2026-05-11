from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    avatar_color = Column(String, default="#6366f1")
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, nullable=True)
    message_type = Column(String, default="text")  # text | image | video | audio | file
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")


class Channel(Base):
    __tablename__ = "channels"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    avatar_url = Column(String, nullable=True)
    avatar_color = Column(String, default="#6366f1")
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id])
    posts = relationship("Post", back_populates="channel", cascade="all, delete-orphan")
    subscriptions = relationship("ChannelSubscription", back_populates="channel", cascade="all, delete-orphan")


class ChannelSubscription(Base):
    __tablename__ = "channel_subscriptions"
    __table_args__ = (UniqueConstraint("channel_id", "user_id"),)
    id = Column(Integer, primary_key=True)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    channel = relationship("Channel", back_populates="subscriptions")


class Post(Base):
    __tablename__ = "posts"
    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=True)
    file_url = Column(String, nullable=True)
    file_type = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    views = Column(Integer, default=0)
    reposts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    channel = relationship("Channel", back_populates="posts")
    author = relationship("User")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan",
                            order_by="PostComment.created_at")


class Group(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    avatar_url = Column(String, nullable=True)
    avatar_color = Column(String, default="#6366f1")
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", foreign_keys=[owner_id])
    members = relationship("GroupMember", back_populates="group", cascade="all, delete-orphan")
    messages = relationship("GroupMessage", back_populates="group", cascade="all, delete-orphan")


class GroupMember(Base):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("group_id", "user_id"),)
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="members")
    user = relationship("User")


class GroupMessage(Base):
    __tablename__ = "group_messages"
    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=True)
    message_type = Column(String, default="text")
    file_url = Column(String, nullable=True)
    file_name = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("Group", back_populates="messages")
    sender = relationship("User")


class PostView(Base):
    __tablename__ = "post_views"
    __table_args__ = (UniqueConstraint("post_id", "user_id"),)
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class PostComment(Base):
    __tablename__ = "post_comments"
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="comments")
    author = relationship("User")
