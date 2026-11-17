import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def uid():
    return uuid.uuid4()


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(80))
    city: Mapped[str] = mapped_column(String(120), default="Екатеринбург")
    role: Mapped[str] = mapped_column(String(20), default="participant")
    expert_permission: Mapped[bool] = mapped_column(Boolean, default=False)
    analytics_permission: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (CheckConstraint("role IN ('participant','organizer','partner','admin')", name="ck_user_role"),)


class LoginSession(Base):
    __tablename__ = "sessions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    identity_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    organizer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(20), index=True)
    city: Mapped[str] = mapped_column(String(120), default="Екатеринбург")
    address: Mapped[str] = mapped_column(String(300))
    lat: Mapped[float] = mapped_column(Numeric(9, 6))
    lon: Mapped[float] = mapped_column(Numeric(9, 6))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(Integer)
    contact: Mapped[str] = mapped_column(String(200))
    inventory: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    competition_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    cancel_reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (
        Index("ix_events_status_start", "status", "start_at"),
        CheckConstraint("status IN ('draft','published','completed','cancelled')", name="ck_event_status"),
        CheckConstraint("type IN ('cleanup','recycling','planting','lecture','quest')", name="ck_event_type"),
        CheckConstraint("capacity BETWEEN 1 AND 500", name="ck_event_capacity"),
        CheckConstraint("end_at > start_at", name="ck_event_dates"),
    )


class Team(Base):
    __tablename__ = "teams"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    description: Mapped[str] = mapped_column(String(500), default="")
    captain_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class TeamMember(Base):
    __tablename__ = "team_members"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"), index=True)


class Participation(Base):
    __tablename__ = "participations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"), index=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("teams.id"))
    status: Mapped[str] = mapped_column(String(20), default="registered")
    hours: Mapped[float | None] = mapped_column(Numeric(6, 2))
    waste_kg: Mapped[float | None] = mapped_column(Numeric(8, 2))
    trees: Mapped[int | None] = mapped_column(Integer)
    base_points: Mapped[int] = mapped_column(Integer, default=0)
    revision: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        UniqueConstraint("user_id", "event_id"),
        CheckConstraint("status IN ('registered','cancelled','attended','no_show')", name="ck_participation_status"),
        CheckConstraint("base_points >= 0", name="ck_participation_points"),
    )


class PointEntry(Base):
    __tablename__ = "point_entries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(30))
    operation_key: Mapped[str] = mapped_column(String(150), unique=True)
    participation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("participations.id"))
    event_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("events.id"))
    redemption_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("redemptions.id"))
    reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class CompetitionResult(Base):
    __tablename__ = "competition_results"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id"))
    base_score: Mapped[int] = mapped_column(Integer)
    rank: Mapped[int] = mapped_column(Integer)
    __table_args__ = (UniqueConstraint("event_id", "team_id"),)


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    code: Mapped[str] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (UniqueConstraint("user_id", "code"),)


class Partner(Base):
    __tablename__ = "partners"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(120))
    public_contact: Mapped[str] = mapped_column(String(200))
    operator_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Offer(Base):
    __tablename__ = "offers"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    partner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("partners.id"))
    title: Mapped[str] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    price: Mapped[int] = mapped_column(Integer)
    stock: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    __table_args__ = (CheckConstraint("stock >= 0", name="ck_offer_stock"), CheckConstraint("price BETWEEN 1 AND 10000", name="ck_offer_price"))


class Redemption(Base):
    __tablename__ = "redemptions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    offer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("offers.id"))
    price_snapshot: Mapped[int] = mapped_column(Integer)
    code_encrypted: Mapped[str] = mapped_column(Text)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True)
    idempotency_key: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), default="issued")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    refund_reason: Mapped[str | None] = mapped_column(String(500))
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key"), CheckConstraint("status IN ('issued','redeemed','refunded')", name="ck_redemption_status"))


class Subscription(Base):
    __tablename__ = "subscriptions"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), primary_key=True)
    city: Mapped[str] = mapped_column(String(120))
    types: Mapped[list] = mapped_column(JSONB, default=list)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    event_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("events.id"))
    type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    message: Mapped[str] = mapped_column(String(500))
    dedupe_key: Mapped[str] = mapped_column(String(150), unique=True)
    send_after: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (CheckConstraint("status IN ('pending','sent','suppressed','failed')", name="ck_notification_status"),)


class Article(Base):
    __tablename__ = "articles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(150))
    text: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80))
    sources: Mapped[list] = mapped_column(JSONB, default=list)
    published: Mapped[bool] = mapped_column(Boolean, default=False)


class Question(Base):
    __tablename__ = "questions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    category: Mapped[str] = mapped_column(String(80))
    text: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(Text)
    expert_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="new")


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    text: Mapped[str] = mapped_column(String(1000))
    photo_paths: Mapped[list] = mapped_column(JSONB, default=list)
    __table_args__ = (UniqueConstraint("user_id", "event_id"),)


class EventPhoto(Base):
    __tablename__ = "event_photos"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    kind: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(255))
