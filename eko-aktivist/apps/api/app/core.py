import hashlib
import os
import secrets
from datetime import timedelta
from uuid import UUID

from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import LoginSession, PointEntry, User, now


password_hash = PasswordHash.recommended()
SESSION_COOKIE = "eco_session"
CSRF_COOKIE = "eco_csrf"


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def fail(status: int, code: str, message: str, field_errors: dict | None = None):
    raise HTTPException(status_code=status, detail={"code": code, "message": message, "field_errors": field_errors or {}})


def require_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        fail(401, "not_authenticated", "Войдите в аккаунт")
    session = db.scalar(select(LoginSession).where(LoginSession.token_hash == digest(token), LoginSession.revoked_at.is_(None)))
    if not session or session.expires_at <= now():
        fail(401, "not_authenticated", "Сессия истекла")
    user = db.get(User, session.user_id)
    if not user or not user.active:
        fail(401, "not_authenticated", "Аккаунт недоступен")
    request.state.session = session
    return user


def require_roles(*roles: str):
    def check(user: User = Depends(require_user)) -> User:
        if user.role not in roles and user.role != "admin":
            fail(403, "forbidden", "Недостаточно прав")
        return user
    return check


def csrf_check(request: Request, user: User = Depends(require_user)) -> User:
    origin = request.headers.get("origin")
    allowed = os.getenv("PUBLIC_ORIGIN", "http://localhost:8080")
    if origin and origin.rstrip("/") != allowed.rstrip("/"):
        fail(403, "bad_origin", "Неверный источник запроса")
    token = request.headers.get("X-CSRF-Token")
    if not token or token != request.cookies.get(CSRF_COOKIE) or digest(token) != request.state.session.csrf_hash:
        fail(403, "bad_csrf", "Обновите страницу и повторите действие")
    return user


def balance(db: Session, user_id: UUID) -> int:
    return int(db.scalar(select(func.coalesce(func.sum(PointEntry.delta), 0)).where(PointEntry.user_id == user_id)) or 0)


def earned(db: Session, user_id: UUID) -> int:
    return int(db.scalar(select(func.coalesce(func.sum(PointEntry.delta), 0)).where(PointEntry.user_id == user_id, PointEntry.kind.in_(["participation", "correction", "organizer", "winner"]))) or 0)


def encrypt_code(code: str) -> str:
    key = os.environ.get("REDEMPTION_KEY")
    if not key:
        raise RuntimeError("REDEMPTION_KEY is required")
    return Fernet(key.encode()).encrypt(code.encode()).decode()


def decrypt_code(value: str) -> str:
    key = os.environ.get("REDEMPTION_KEY")
    if not key:
        raise RuntimeError("REDEMPTION_KEY is required")
    return Fernet(key.encode()).decrypt(value.encode()).decode()


def new_session(db: Session, user: User):
    token = secrets.token_urlsafe(32)
    csrf = secrets.token_urlsafe(32)
    session = LoginSession(user_id=user.id, token_hash=digest(token), csrf_hash=digest(csrf), expires_at=now() + timedelta(days=7))
    db.add(session)
    db.flush()
    return token, csrf
