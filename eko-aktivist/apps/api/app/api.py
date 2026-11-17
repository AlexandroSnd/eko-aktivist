import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_FLOOR

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .core import CSRF_COOKIE, SESSION_COOKIE, balance, csrf_check, decrypt_code, digest, encrypt_code, earned, fail, new_session, password_hash, require_roles, require_user
from .db import get_db
from .models import Badge, CompetitionResult, Event, LoginAttempt, LoginSession, Notification, Offer, Participation, Partner, PointEntry, Redemption, Subscription, Team, TeamMember, User, now
from .schemas import CancelEvent, EventInput, EventPatch, JoinEvent, Login, ProfilePatch, RedeemCode, RedemptionInput, Register, ResultInput, TeamInput


router = APIRouter(prefix="/api/v1")


def data(obj, *fields):
    values = {}
    for field in fields:
        value = getattr(obj, field)
        if isinstance(value, Decimal):
            value = float(value) if field in ("lat", "lon") else f"{value:.2f}"
        elif isinstance(value, datetime):
            value = value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        values[field] = value
    return values


def profile(db, user):
    return {**data(user, "id", "name", "email", "city", "role", "expert_permission", "analytics_permission"), "balance": balance(db, user.id), "earned_points": earned(db, user.id)}


def event_data(db, event):
    occupied = db.scalar(select(func.count()).select_from(Participation).where(Participation.event_id == event.id, Participation.status != "cancelled")) or 0
    return {**data(event, "id", "title", "description", "type", "city", "address", "lat", "lon", "start_at", "end_at", "capacity", "contact", "inventory", "status", "competition_enabled", "organizer_id", "cancel_reason"), "places_left": event.capacity - occupied}


def redemption_data(db, item, show_code=False):
    result = data(item, "id", "offer_id", "price_snapshot", "status", "expires_at", "redeemed_at")
    if show_code and item.status == "issued":
        result["code"] = decrypt_code(item.code_encrypted)
    return result


def require_preauth_csrf(request: Request):
    token = request.headers.get("X-CSRF-Token")
    key = os.environ.get("CSRF_SIGNING_KEY", "")
    signature = request.cookies.get("eco_preauth_sig", "")
    expected = hmac.new(key.encode(), (token or "").encode(), hashlib.sha256).hexdigest() if key else ""
    if not token or token != request.cookies.get(CSRF_COOKIE) or not hmac.compare_digest(signature, expected):
        fail(403, "bad_csrf", "Обновите страницу и повторите действие")
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") != os.getenv("PUBLIC_ORIGIN", "http://localhost:8080").rstrip("/"):
        fail(403, "bad_origin", "Неверный источник запроса")


@router.get("/auth/csrf")
def csrf(response: Response, request: Request, db: Session = Depends(get_db)):
    raw = request.cookies.get(SESSION_COOKIE)
    session = db.scalar(select(LoginSession).where(LoginSession.token_hash == digest(raw))) if raw else None
    token = secrets.token_urlsafe(32)
    if session and session.revoked_at is None and session.expires_at > now():
        session.csrf_hash = digest(token)
        db.commit()
        response.delete_cookie("eco_preauth_sig")
    else:
        key = os.environ.get("CSRF_SIGNING_KEY")
        if not key:
            raise RuntimeError("CSRF_SIGNING_KEY is required")
        signature = hmac.new(key.encode(), token.encode(), hashlib.sha256).hexdigest()
        response.set_cookie("eco_preauth_sig", signature, httponly=True, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "true", max_age=600, path="/")
    response.set_cookie(CSRF_COOKIE, token, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "true", max_age=604800, path="/")
    return {"csrf_token": token}


@router.post("/auth/register", status_code=201)
def register(body: Register, request: Request, response: Response, db: Session = Depends(get_db)):
    require_preauth_csrf(request)
    email = str(body.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        fail(422, "invalid_fields", "Email уже используется", {"email": ["Email уже используется"]})
    user = User(email=email, name=body.name, password_hash=password_hash.hash(body.password))
    db.add(user)
    db.flush()
    token, csrf_token = new_session(db, user)
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "true", max_age=604800, path="/")
    response.set_cookie(CSRF_COOKIE, csrf_token, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "true", max_age=604800, path="/")
    response.delete_cookie("eco_preauth_sig")
    return profile(db, user)


@router.post("/auth/login")
def login(body: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    require_preauth_csrf(request)
    email = str(body.email).lower()
    client_ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")
    identity_hash = digest(f"{email}:{client_ip}")
    since = now() - timedelta(minutes=15)
    failed = db.scalar(select(func.count()).select_from(LoginAttempt).where(LoginAttempt.identity_hash == identity_hash, LoginAttempt.created_at >= since)) or 0
    if failed >= 5:
        fail(429, "login_rate_limited", "Слишком много попыток. Повторите через 15 минут")
    user = db.scalar(select(User).where(User.email == email, User.active.is_(True)))
    if not user or not password_hash.verify(body.password, user.password_hash):
        db.add(LoginAttempt(identity_hash=identity_hash))
        db.commit()
        fail(401, "invalid_credentials", "Неверный email или пароль")
    db.query(LoginAttempt).filter(LoginAttempt.identity_hash == identity_hash).delete()
    token, csrf_token = new_session(db, user)
    db.commit()
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "true", max_age=604800, path="/")
    response.set_cookie(CSRF_COOKIE, csrf_token, samesite="lax", secure=os.getenv("COOKIE_SECURE") == "true", max_age=604800, path="/")
    response.delete_cookie("eco_preauth_sig")
    return profile(db, user)


@router.post("/auth/logout", status_code=204)
def logout(response: Response, request: Request, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    request.state.session.revoked_at = now()
    db.commit()
    response.delete_cookie(SESSION_COOKIE)
    response.delete_cookie(CSRF_COOKIE)


@router.get("/me")
def me(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return profile(db, user)


@router.patch("/me")
def patch_me(body: ProfilePatch, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is None:
            fail(422, "invalid_fields", "Поле не может быть пустым")
        setattr(user, key, value)
    db.commit()
    return profile(db, user)


@router.get("/events")
def events(type: str | None = None, organizer: uuid.UUID | None = None, from_: str | None = Query(default=None, alias="from"), to: str | None = None, bbox: str | None = None, page: int = 1, page_size: int = 20, db: Session = Depends(get_db)):
    from datetime import datetime
    if page < 1 or not 1 <= page_size <= 100:
        fail(422, "invalid_fields", "Некорректная пагинация")
    query = select(Event).where(Event.status == "published", Event.start_at > now())
    if type:
        query = query.where(Event.type == type)
    if organizer:
        query = query.where(Event.organizer_id == organizer)
    try:
        if from_:
            start = datetime.fromisoformat(from_.replace("Z", "+00:00"))
            if start.tzinfo is None:
                raise ValueError("timezone required")
            query = query.where(Event.start_at >= start)
        if to:
            end = datetime.fromisoformat(to.replace("Z", "+00:00"))
            if end.tzinfo is None:
                raise ValueError("timezone required")
            query = query.where(Event.start_at <= end)
        if bbox:
            west, south, east, north = map(float, bbox.split(","))
            query = query.where(Event.lon >= west, Event.lon <= east, Event.lat >= south, Event.lat <= north)
    except (ValueError, TypeError):
        fail(422, "invalid_fields", "Некорректные фильтры")
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(query.order_by(Event.start_at, Event.id).offset((page - 1) * page_size).limit(page_size)).all()
    return {"items": [event_data(db, x) for x in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/events/map")
def event_map(bbox: str | None = None, type: str | None = None, organizer: uuid.UUID | None = None, from_: datetime | None = Query(default=None, alias="from"), to: datetime | None = None, db: Session = Depends(get_db)):
    query = select(Event).where(Event.status == "published", Event.start_at > now())
    if (from_ and from_.tzinfo is None) or (to and to.tzinfo is None):
        fail(422, "invalid_fields", "Укажите часовой пояс")
    if type:
        query = query.where(Event.type == type)
    if organizer:
        query = query.where(Event.organizer_id == organizer)
    if from_:
        query = query.where(Event.start_at >= from_)
    if to:
        query = query.where(Event.start_at <= to)
    if bbox:
        try:
            west, south, east, north = map(float, bbox.split(","))
        except ValueError:
            fail(422, "invalid_fields", "Некорректная область карты")
        query = query.where(Event.lon >= west, Event.lon <= east, Event.lat >= south, Event.lat <= north)
    return {"items": [data(e, "id", "title", "lat", "lon", "start_at", "type") for e in db.scalars(query.order_by(Event.start_at).limit(200))]}


@router.get("/events/{event_id}")
def get_event(event_id: uuid.UUID, db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if not event or event.status == "draft":
        fail(404, "not_found", "Событие не найдено")
    return event_data(db, event)


@router.get("/organizer/events")
def organizer_events(user: User = Depends(require_roles("organizer")), db: Session = Depends(get_db)):
    return {"items": [event_data(db, e) for e in db.scalars(select(Event).where(Event.organizer_id == user.id).order_by(Event.start_at.desc()))]}


@router.post("/events", status_code=201)
def create_event(body: EventInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    if user.role not in ("organizer", "admin"):
        fail(403, "forbidden", "Недостаточно прав")
    event = Event(**body.model_dump(), organizer_id=user.id)
    db.add(event)
    db.commit()
    return event_data(db, event)


def owned_event(db, event_id, user, lock=False):
    query = select(Event).where(Event.id == event_id)
    if lock:
        query = query.with_for_update()
    event = db.scalar(query)
    if not event:
        fail(404, "not_found", "Событие не найдено")
    if event.organizer_id != user.id and user.role != "admin":
        fail(403, "forbidden", "Чужое событие")
    return event


@router.patch("/events/{event_id}")
def patch_event(event_id: uuid.UUID, body: EventPatch, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    event = owned_event(db, event_id, user, True)
    if event.status not in ("draft", "published"):
        fail(409, "event_closed", "Событие закрыто")
    updates = body.model_dump(exclude_unset=True)
    if any(v is None for v in updates.values()):
        fail(422, "invalid_fields", "Пустое значение недопустимо")
    if db.scalar(select(Participation.id).where(Participation.event_id == event.id).limit(1)) and set(updates) - {"description", "inventory"}:
        fail(409, "event_locked", "После первой записи можно изменить только описание и инвентарь")
    for key, value in updates.items():
        setattr(event, key, value)
    if event.end_at <= event.start_at:
        fail(422, "invalid_fields", "Конец должен быть позже начала")
    if event.status == "published" and event.start_at <= now():
        fail(409, "event_started", "Нельзя изменить начавшееся событие")
    occupied = db.scalar(select(func.count()).select_from(Participation).where(Participation.event_id == event.id, Participation.status != "cancelled")) or 0
    if event.capacity < occupied:
        fail(409, "capacity_full", "Вместимость меньше числа записей")
    db.commit()
    return event_data(db, event)


@router.post("/events/{event_id}/publish")
def publish(event_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    event = owned_event(db, event_id, user, True)
    if event.status == "published":
        return event_data(db, event)
    if event.status != "draft" or event.start_at <= now():
        fail(409, "event_unavailable", "Событие нельзя опубликовать")
    event.status = "published"
    subs = db.scalars(select(Subscription).where(Subscription.city == event.city)).all()
    for sub in subs:
        if not sub.types or event.type in sub.types:
            db.add(Notification(user_id=sub.user_id, event_id=event.id, type="new_event", message=f"Новая акция: {event.title}", dedupe_key=f"new:{event.id}:{sub.user_id}"))
    db.commit()
    return event_data(db, event)


@router.post("/events/{event_id}/cancel")
def cancel_event(event_id: uuid.UUID, body: CancelEvent, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    event = owned_event(db, event_id, user, True)
    if event.status == "cancelled":
        return event_data(db, event)
    if event.status not in ("draft", "published") or event.start_at <= now():
        fail(409, "event_started", "Событие уже началось")
    event.status, event.cancel_reason = "cancelled", body.reason
    for note in db.scalars(select(Notification).where(Notification.event_id == event.id, Notification.type == "new_event", Notification.status == "pending")):
        note.status, note.sent_at = "suppressed", now()
    for p in db.scalars(select(Participation).where(Participation.event_id == event.id, Participation.status == "registered")):
        p.status = "cancelled"
        db.add(Notification(user_id=p.user_id, event_id=event.id, type="cancelled", message=f"Акция отменена: {body.reason}", dedupe_key=f"cancel:{event.id}:{p.user_id}"))
        reminder = db.scalar(select(Notification).where(Notification.dedupe_key == f"reminder:{p.id}"))
        if reminder and reminder.status == "pending":
            reminder.status, reminder.sent_at = "suppressed", now()
    db.commit()
    return event_data(db, event)


@router.delete("/events/{event_id}", status_code=204)
def delete_draft(event_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    event = owned_event(db, event_id, user, True)
    if event.status != "draft" or db.scalar(select(Participation.id).where(Participation.event_id == event.id).limit(1)):
        fail(409, "event_locked", "Удалить можно только пустой черновик")
    db.delete(event)
    db.commit()


@router.post("/events/{event_id}/participations", status_code=201)
def join_event(event_id: uuid.UUID, body: JoinEvent, response: Response, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    if user.role == "partner":
        fail(403, "forbidden", "Партнёр не записывается на акции")
    event = db.scalar(select(Event).where(Event.id == event_id).with_for_update())
    if not event or event.status != "published":
        fail(409, "event_unavailable", "Запись недоступна")
    if event.start_at <= now():
        fail(409, "event_started", "Акция уже началась")
    if event.organizer_id == user.id:
        fail(403, "forbidden", "Нельзя записаться на своё событие")
    existing = db.scalar(select(Participation).where(Participation.event_id == event.id, Participation.user_id == user.id))
    if existing and existing.status != "cancelled":
        response.status_code = 200
        return data(existing, "id", "event_id", "user_id", "team_id", "status", "created_at")
    if body.team_id:
        if not event.competition_enabled or not db.get(TeamMember, user.id) or db.get(TeamMember, user.id).team_id != body.team_id:
            fail(409, "invalid_team", "Вы не состоите в этой команде")
    occupied = db.scalar(select(func.count()).select_from(Participation).where(Participation.event_id == event.id, Participation.status != "cancelled")) or 0
    if occupied >= event.capacity:
        fail(409, "capacity_full", "Мест больше нет")
    if existing:
        existing.status, existing.team_id = "registered", body.team_id
        reminder = db.scalar(select(Notification).where(Notification.dedupe_key == f"reminder:{existing.id}"))
        if reminder and reminder.status == "suppressed":
            reminder.status, reminder.sent_at, reminder.attempts, reminder.send_after = "pending", None, 0, now()
        response.status_code = 200
        item = existing
    else:
        item = Participation(event_id=event.id, user_id=user.id, team_id=body.team_id)
        db.add(item)
    db.commit()
    return data(item, "id", "event_id", "user_id", "team_id", "status", "created_at")


@router.post("/participations/{participation_id}/cancel")
def cancel_participation(participation_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    item = db.get(Participation, participation_id)
    if not item:
        fail(404, "not_found", "Запись не найдена")
    event = db.scalar(select(Event).where(Event.id == item.event_id).with_for_update())
    item = db.scalar(select(Participation).where(Participation.id == participation_id).with_for_update().execution_options(populate_existing=True))
    if item.user_id != user.id:
        fail(403, "forbidden", "Чужая запись")
    if event.start_at <= now():
        fail(409, "event_started", "Акция уже началась")
    if item.status == "cancelled":
        return data(item, "id", "status")
    if item.status != "registered":
        fail(409, "invalid_status", "Запись уже обработана")
    item.status = "cancelled"
    reminder = db.scalar(select(Notification).where(Notification.dedupe_key == f"reminder:{item.id}"))
    if reminder and reminder.status == "pending":
        reminder.status, reminder.sent_at = "suppressed", now()
    db.commit()
    return data(item, "id", "status")


@router.put("/participations/{participation_id}/team")
def change_team(participation_id: uuid.UUID, body: JoinEvent, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    item = db.get(Participation, participation_id)
    if not item:
        fail(404, "not_found", "Запись не найдена")
    event = db.get(Event, item.event_id)
    if item.user_id != user.id:
        fail(403, "forbidden", "Чужая запись")
    if event.start_at <= now() or item.status != "registered":
        fail(409, "event_started", "Команда уже зафиксирована")
    member = db.get(TeamMember, user.id)
    if body.team_id and (not event.competition_enabled or not member or member.team_id != body.team_id):
        fail(409, "invalid_team", "Вы не состоите в этой команде")
    item.team_id = body.team_id
    db.commit()
    return data(item, "id", "team_id")


@router.get("/events/{event_id}/participants")
def participants(event_id: uuid.UUID, user: User = Depends(require_user), db: Session = Depends(get_db)):
    owned_event(db, event_id, user)
    rows = db.execute(select(Participation, User).join(User, User.id == Participation.user_id).where(Participation.event_id == event_id)).all()
    return {"items": [{**data(p, "id", "status", "hours", "waste_kg", "trees", "base_points", "revision", "team_id"), "user": data(u, "id", "name", "email")} for p, u in rows]}


def calculated_points(event_type, body):
    if body.status == "no_show":
        if any(v is not None for v in (body.hours, body.waste_kg, body.trees)):
            fail(422, "invalid_fields", "Неявка не содержит вклад")
        return 0
    if body.status != "attended":
        fail(422, "invalid_fields", "Неизвестный статус")
    if event_type == "cleanup":
        if body.hours is None or body.hours <= 0:
            fail(422, "invalid_fields", "Укажите часы уборки")
        return int((body.hours * 10).to_integral_value(rounding=ROUND_FLOOR))
    if event_type == "recycling":
        if body.waste_kg is None or body.waste_kg <= 0:
            fail(422, "invalid_fields", "Укажите вес вторсырья")
        return int((body.waste_kg * 5).to_integral_value(rounding=ROUND_FLOOR))
    if event_type == "planting":
        if body.trees is None or body.trees <= 0:
            fail(422, "invalid_fields", "Укажите число деревьев")
        return body.trees * 15
    return 10


@router.put("/participations/{participation_id}/result")
def set_result(participation_id: uuid.UUID, body: ResultInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    initial = db.get(Participation, participation_id)
    if not initial:
        fail(404, "not_found", "Запись не найдена")
    event = db.scalar(select(Event).where(Event.id == initial.event_id).with_for_update())
    if event.organizer_id != user.id and user.role != "admin":
        fail(403, "forbidden", "Чужое событие")
    if event.end_at > now():
        fail(409, "event_not_finished", "Событие ещё не закончилось")
    if event.status == "completed":
        fail(409, "event_completed", "Результаты закрыты")
    if event.status != "published":
        fail(409, "event_unavailable", "Событие недоступно")
    item = db.scalar(select(Participation).where(Participation.id == participation_id).with_for_update().execution_options(populate_existing=True))
    if item.status not in ("registered", "attended", "no_show"):
        fail(409, "not_registered", "Нет активной записи")
    points = calculated_points(event.type, body)
    same = item.status == body.status and item.hours == body.hours and item.waste_kg == body.waste_kg and item.trees == body.trees
    if same:
        return {"participation": data(item, "id", "status", "revision"), "base_points": item.base_points, "balance": balance(db, item.user_id), "revision": item.revision}
    if item.revision and not body.reason:
        fail(422, "invalid_fields", "Для исправления укажите причину")
    target = db.scalar(select(User).where(User.id == item.user_id).with_for_update())
    delta = points - item.base_points
    if balance(db, target.id) + delta < 0:
        fail(409, "insufficient_balance_for_correction", "Сначала верните непогашенный обмен")
    if item.base_points:
        db.add(PointEntry(user_id=target.id, delta=-item.base_points, kind="correction", operation_key=f"result:{item.id}:{item.revision}:reverse", participation_id=item.id, event_id=event.id, reason=body.reason))
    item.revision += 1
    if points:
        db.add(PointEntry(user_id=target.id, delta=points, kind="participation", operation_key=f"result:{item.id}:{item.revision}:award", participation_id=item.id, event_id=event.id, reason=body.reason))
    item.status = body.status
    item.hours, item.waste_kg, item.trees = (body.hours, body.waste_kg, body.trees) if body.status == "attended" else (None, None, None)
    item.base_points, item.confirmed_at = points, now()
    db.flush()
    refresh_badges(db, target.id)
    db.commit()
    return {"participation": data(item, "id", "status", "revision"), "base_points": points, "balance": balance(db, target.id), "revision": item.revision}


def refresh_badges(db, user_id):
    count = db.scalar(select(func.count()).select_from(Participation).where(Participation.user_id == user_id, Participation.status == "attended")) or 0
    organized = db.scalar(select(func.count()).select_from(Event).where(Event.organizer_id == user_id, Event.status == "completed")) or 0
    wanted = {"first_participation": count >= 1, "five_participations": count >= 5, "first_organization": organized >= 1}
    existing = {b.code: b for b in db.scalars(select(Badge).where(Badge.user_id == user_id))}
    for code, active in wanted.items():
        if code in existing:
            existing[code].active = active
        elif active:
            db.add(Badge(user_id=user_id, code=code))


@router.post("/events/{event_id}/complete")
def complete_event(event_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    event = owned_event(db, event_id, user, True)
    if event.status == "completed":
        return event_data(db, event)
    if event.end_at > now():
        fail(409, "event_not_finished", "Событие ещё не закончилось")
    if event.status != "published":
        fail(409, "event_unavailable", "Событие недоступно")
    active = db.scalars(select(Participation).where(Participation.event_id == event.id, Participation.status == "registered")).all()
    if active:
        fail(409, "unprocessed_participations", "Обработайте все записи")
    attended = db.scalars(select(Participation).where(Participation.event_id == event.id, Participation.status == "attended")).all()
    user_ids = sorted({p.user_id for p in attended} | {event.organizer_id}, key=str)
    db.scalars(select(User).where(User.id.in_(user_ids)).order_by(User.id).with_for_update()).all()
    if attended:
        organizer = db.scalar(select(User).where(User.id == event.organizer_id).with_for_update())
        db.add(PointEntry(user_id=organizer.id, delta=30, kind="organizer", operation_key=f"organizer:{event.id}:{organizer.id}", event_id=event.id))
    if event.competition_enabled:
        scores = {}
        for p in attended:
            if p.team_id:
                score, count = scores.get(p.team_id, (0, 0))
                scores[p.team_id] = (score + p.base_points, count + 1)
        eligible = sorted(((team, score) for team, (score, count) in scores.items() if count >= 2), key=lambda x: (-x[1], str(x[0])))
        leader = eligible[0][1] if eligible else None
        rank = 0
        previous = None
        for index, (team_id, score) in enumerate(eligible):
            if score != previous:
                rank = index + 1
            previous = score
            db.add(CompetitionResult(event_id=event.id, team_id=team_id, base_score=score, rank=rank))
            if score == leader:
                for p in attended:
                    if p.team_id == team_id:
                        db.add(PointEntry(user_id=p.user_id, delta=20, kind="winner", operation_key=f"winner:{event.id}:{p.user_id}", event_id=event.id, participation_id=p.id))
    event.status = "completed"
    db.flush()
    refresh_badges(db, event.organizer_id)
    db.commit()
    return event_data(db, event)


@router.get("/events/{event_id}/stats")
def event_stats(event_id: uuid.UUID, user: User = Depends(require_user), db: Session = Depends(get_db)):
    owned_event(db, event_id, user)
    rows = db.scalars(select(Participation).where(Participation.event_id == event_id)).all()
    return {"registered": sum(p.status == "registered" for p in rows), "attended": sum(p.status == "attended" for p in rows), "no_show": sum(p.status == "no_show" for p in rows), "hours": f"{sum((p.hours or Decimal(0) for p in rows if p.status == 'attended'), Decimal(0)):.2f}", "waste_kg": f"{sum((p.waste_kg or Decimal(0) for p in rows if p.status == 'attended'), Decimal(0)):.2f}", "trees": sum(p.trees or 0 for p in rows if p.status == "attended")}


@router.get("/events/{event_id}/competition")
def competition(event_id: uuid.UUID, db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if not event or event.status == "draft":
        fail(404, "not_found", "Событие не найдено")
    rows = db.execute(select(CompetitionResult, Team).join(Team, Team.id == CompetitionResult.team_id).where(CompetitionResult.event_id == event_id).order_by(CompetitionResult.rank)).all()
    return {"items": [{"team_id": t.id, "team_name": t.name, "base_score": c.base_score, "rank": c.rank} for c, t in rows]}


@router.get("/me/participations")
def my_participations(user: User = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.execute(select(Participation, Event).join(Event, Event.id == Participation.event_id).where(Participation.user_id == user.id).order_by(Event.start_at.desc())).all()
    return {"items": [{"participation": data(p, "id", "status", "team_id", "hours", "waste_kg", "trees", "base_points", "created_at"), "event": event_data(db, e)} for p, e in rows]}


@router.get("/me/team")
def my_team(user: User = Depends(require_user), db: Session = Depends(get_db)):
    member = db.get(TeamMember, user.id)
    if not member:
        return {"team": None}
    team = db.get(Team, member.team_id)
    return {"team": data(team, "id", "name", "captain_id") if team and team.active else None}


@router.get("/me/points")
def my_points(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return {"items": [data(p, "id", "delta", "kind", "reason", "created_at") for p in db.scalars(select(PointEntry).where(PointEntry.user_id == user.id).order_by(PointEntry.created_at.desc()))], "balance": balance(db, user.id)}


@router.get("/me/impact")
def my_impact(user: User = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Participation).where(Participation.user_id == user.id, Participation.status == "attended")).all()
    return {"hours": f"{sum((p.hours or Decimal(0) for p in rows), Decimal(0)):.2f}", "waste_kg": f"{sum((p.waste_kg or Decimal(0) for p in rows), Decimal(0)):.2f}", "trees": sum(p.trees or 0 for p in rows), "participations": len(rows)}


@router.get("/rating")
def rating(db: Session = Depends(get_db)):
    rows = db.scalars(select(User).where(User.active.is_(True), User.role != "partner")).all()
    users = sorted(({"id": u.id, "name": u.name, "city": u.city, "points": earned(db, u.id)} for u in rows), key=lambda x: (-x["points"], str(x["id"])))
    return {"items": users[:100]}


@router.get("/me/achievements")
def achievements(user: User = Depends(require_user), db: Session = Depends(get_db)):
    points = earned(db, user.id)
    level = "хранитель" if points >= 200 else "активист" if points >= 50 else "новичок"
    return {"earned_points": points, "level": level, "badges": [b.code for b in db.scalars(select(Badge).where(Badge.user_id == user.id, Badge.active.is_(True)))]}


@router.get("/teams")
def teams(db: Session = Depends(get_db)):
    return {"items": [data(t, "id", "name", "description", "captain_id") for t in db.scalars(select(Team).where(Team.active.is_(True)).order_by(Team.name))]}


@router.post("/teams", status_code=201)
def create_team(body: TeamInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    if db.get(TeamMember, user.id):
        fail(409, "already_in_team", "Вы уже состоите в команде")
    if db.scalar(select(Team.id).where(Team.name == body.name)):
        fail(409, "team_exists", "Такое название уже занято")
    team = Team(**body.model_dump(), captain_id=user.id)
    db.add(team)
    db.flush()
    db.add(TeamMember(user_id=user.id, team_id=team.id))
    db.commit()
    return data(team, "id", "name", "description", "captain_id")


@router.get("/teams/{team_id}")
def get_team(team_id: uuid.UUID, db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if not team or not team.active:
        fail(404, "not_found", "Команда не найдена")
    users = db.scalars(select(User).join(TeamMember, TeamMember.user_id == User.id).where(TeamMember.team_id == team.id)).all()
    return {**data(team, "id", "name", "description", "captain_id"), "members": [data(u, "id", "name", "city") for u in users]}


@router.post("/teams/{team_id}/join")
def join_team(team_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if not team or not team.active:
        fail(404, "not_found", "Команда не найдена")
    member = db.get(TeamMember, user.id)
    if member:
        if member.team_id == team.id:
            return get_team(team.id, db)
        fail(409, "already_in_team", "Вы уже состоите в другой команде")
    db.add(TeamMember(user_id=user.id, team_id=team.id))
    db.commit()
    return get_team(team.id, db)


@router.post("/teams/{team_id}/leave")
def leave_team(team_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    member = db.get(TeamMember, user.id)
    if not team or not member or member.team_id != team_id:
        fail(404, "not_found", "Членство не найдено")
    count = db.scalar(select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id))
    if team.captain_id == user.id and count > 1:
        fail(409, "captain_transfer_required", "Сначала передайте капитанство")
    db.delete(member)
    if count == 1:
        team.active = False
    db.commit()
    return {"left": True}


@router.get("/partners")
def partners(db: Session = Depends(get_db)):
    return {"items": [data(p, "id", "name", "public_contact") for p in db.scalars(select(Partner).where(Partner.active.is_(True)))]}


@router.get("/offers")
def offers(db: Session = Depends(get_db)):
    rows = db.execute(select(Offer, Partner).join(Partner, Partner.id == Offer.partner_id).where(Offer.active.is_(True), Offer.expires_at > now(), Partner.active.is_(True))).all()
    return {"items": [{**data(o, "id", "title", "description", "price", "stock", "expires_at", "is_demo", "partner_id"), "partner_name": p.name} for o, p in rows]}


@router.get("/offers/{offer_id}")
def get_offer(offer_id: uuid.UUID, db: Session = Depends(get_db)):
    offer = db.get(Offer, offer_id)
    if not offer or not offer.active or offer.expires_at <= now():
        fail(404, "not_found", "Предложение не найдено")
    return data(offer, "id", "title", "description", "price", "stock", "expires_at", "is_demo", "partner_id")


@router.post("/redemptions", status_code=201)
def redeem_offer(body: RedemptionInput, response: Response, idempotency_key: uuid.UUID = Header(alias="Idempotency-Key"), user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    db.scalar(select(User).where(User.id == user.id).with_for_update())
    previous = db.scalar(select(Redemption).where(Redemption.user_id == user.id, Redemption.idempotency_key == idempotency_key))
    if previous:
        if previous.offer_id != body.offer_id:
            fail(409, "idempotency_conflict", "Ключ уже применён к другому предложению")
        response.status_code = 200
        return {**redemption_data(db, previous, True), "balance": balance(db, user.id)}
    offer = db.scalar(select(Offer).where(Offer.id == body.offer_id).with_for_update())
    if not offer or not offer.active or offer.expires_at <= now():
        fail(409, "offer_unavailable", "Предложение недоступно")
    if offer.stock <= 0:
        fail(409, "out_of_stock", "Предложение закончилось")
    if balance(db, user.id) < offer.price:
        fail(409, "insufficient_points", "Недостаточно баллов")
    code = secrets.token_urlsafe(16)
    item = Redemption(user_id=user.id, offer_id=offer.id, price_snapshot=offer.price, code_encrypted=encrypt_code(code), code_hash=digest(code), idempotency_key=idempotency_key, expires_at=min(now() + timedelta(days=7), offer.expires_at))
    db.add(item)
    db.flush()
    offer.stock -= 1
    db.add(PointEntry(user_id=user.id, delta=-offer.price, kind="redemption", operation_key=f"redemption:{item.id}", redemption_id=item.id))
    db.commit()
    return {**redemption_data(db, item, True), "balance": balance(db, user.id)}


@router.get("/me/redemptions")
def my_redemptions(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return {"items": [redemption_data(db, x, True) for x in db.scalars(select(Redemption).where(Redemption.user_id == user.id))]}


@router.get("/redemptions/{redemption_id}")
def get_redemption(redemption_id: uuid.UUID, user: User = Depends(require_user), db: Session = Depends(get_db)):
    item = db.get(Redemption, redemption_id)
    if not item:
        fail(404, "not_found", "Обмен не найден")
    if item.user_id != user.id:
        fail(403, "forbidden", "Чужой обмен")
    return redemption_data(db, item, True)


@router.post("/partner/redemptions/redeem")
def redeem_code(body: RedeemCode, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    if user.role not in ("partner", "admin"):
        fail(403, "forbidden", "Недостаточно прав")
    code = body.code
    item = db.scalar(select(Redemption).where(Redemption.code_hash == digest(code)))
    if not item:
        fail(404, "not_found", "Код не найден")
    owner = db.scalar(select(User).where(User.id == item.user_id).with_for_update())
    offer = db.scalar(select(Offer).where(Offer.id == item.offer_id).with_for_update())
    partner = db.get(Partner, offer.partner_id)
    if partner.operator_user_id != user.id and user.role != "admin":
        fail(403, "forbidden", "Чужой код")
    item = db.scalar(select(Redemption).where(Redemption.id == item.id).with_for_update().execution_options(populate_existing=True))
    if item.status == "redeemed":
        return redemption_data(db, item)
    if item.status == "refunded":
        fail(409, "redemption_refunded", "Обмен возвращён")
    if item.expires_at <= now():
        fail(409, "redemption_expired", "Срок кода истёк")
    item.status, item.redeemed_at = "redeemed", now()
    db.commit()
    return redemption_data(db, item)
