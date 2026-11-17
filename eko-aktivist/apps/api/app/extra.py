import os
import uuid
from datetime import datetime, timedelta
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from PIL import Image, UnidentifiedImageError

from .api import data, owned_event, redemption_data
from .core import balance, csrf_check, fail, require_user
from .db import get_db
from .models import Article, Event, EventPhoto, Feedback, Notification, Offer, Partner, Participation, PointEntry, Question, Redemption, Subscription, Team, TeamMember, User, now
from .schemas import AnswerInput, ArticleInput, FeedbackInput, OfferInput, PartnerInput, PermissionsInput, QuestionInput, RefundInput, SubscriptionInput, TransferInput


router = APIRouter(prefix="/api/v1")


def admin(user):
    if user.role != "admin":
        fail(403, "forbidden", "Требуются права администратора")


@router.get("/articles")
def articles(db: Session = Depends(get_db)):
    return {"items": [data(a, "id", "title", "text", "category", "sources") for a in db.scalars(select(Article).where(Article.published.is_(True)))]}


@router.get("/articles/{article_id}")
def article(article_id: uuid.UUID, db: Session = Depends(get_db)):
    item = db.get(Article, article_id)
    if not item or not item.published:
        fail(404, "not_found", "Статья не найдена")
    return data(item, "id", "title", "text", "category", "sources")


@router.get("/leaders")
def leaders(city: str | None = None, db: Session = Depends(get_db)):
    query = select(User).where(User.role == "organizer", User.active.is_(True))
    if city:
        query = query.where(User.city == city)
    result = []
    for u in db.scalars(query):
        event = db.scalar(select(Event).where(Event.organizer_id == u.id, Event.status == "published").order_by(Event.start_at.desc()).limit(1))
        result.append({**data(u, "id", "name", "city"), "public_contact": event.contact if event else None})
    return {"items": result}


@router.get("/questions")
def questions(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return {"items": [data(q, "id", "category", "text", "answer", "status") for q in db.scalars(select(Question).where(Question.author_id == user.id))]}


@router.post("/questions", status_code=201)
def ask(body: QuestionInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    q = Question(**body.model_dump(), author_id=user.id)
    db.add(q)
    db.commit()
    return data(q, "id", "category", "text", "answer", "status")


@router.get("/questions/{question_id}")
def question(question_id: uuid.UUID, user: User = Depends(require_user), db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if not q:
        fail(404, "not_found", "Вопрос не найден")
    if q.author_id != user.id and not user.expert_permission and user.role != "admin":
        fail(403, "forbidden", "Чужой вопрос")
    return data(q, "id", "category", "text", "answer", "status")


@router.post("/questions/{question_id}/close")
def close_question(question_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    q = db.get(Question, question_id)
    if not q:
        fail(404, "not_found", "Вопрос не найден")
    if q.author_id != user.id and user.role != "admin":
        fail(403, "forbidden", "Чужой вопрос")
    q.status = "closed"
    db.commit()
    return data(q, "id", "status")


@router.get("/expert/questions")
def expert_questions(user: User = Depends(require_user), db: Session = Depends(get_db)):
    if not user.expert_permission and user.role != "admin":
        fail(403, "forbidden", "Нет права эксперта")
    return {"items": [data(q, "id", "category", "text", "status") for q in db.scalars(select(Question).where(Question.status == "new"))]}


@router.put("/expert/questions/{question_id}/answer")
def answer(question_id: uuid.UUID, body: AnswerInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    if not user.expert_permission and user.role != "admin":
        fail(403, "forbidden", "Нет права эксперта")
    q = db.scalar(select(Question).where(Question.id == question_id).with_for_update())
    if not q:
        fail(404, "not_found", "Вопрос не найден")
    if q.status == "answered" and q.answer == body.answer:
        return data(q, "id", "answer", "status")
    if q.status != "new":
        fail(409, "question_closed", "Ответ уже опубликован")
    q.answer, q.expert_id, q.status = body.answer, user.id, "answered"
    db.add(Notification(user_id=q.author_id, type="answer", message="Эксперт ответил на ваш вопрос", dedupe_key=f"answer:{q.id}"))
    db.commit()
    return data(q, "id", "answer", "status")


@router.get("/me/subscription")
def get_subscription(user: User = Depends(require_user), db: Session = Depends(get_db)):
    sub = db.get(Subscription, user.id)
    return data(sub, "city", "types") if sub else {"city": user.city, "types": []}


@router.put("/me/subscription")
def set_subscription(body: SubscriptionInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    sub = db.get(Subscription, user.id)
    if sub:
        sub.city, sub.types = body.city, body.types
    else:
        sub = Subscription(user_id=user.id, **body.model_dump())
        db.add(sub)
    db.commit()
    return data(sub, "city", "types")


@router.get("/notifications")
def notifications(user: User = Depends(require_user), db: Session = Depends(get_db)):
    return {"items": [data(n, "id", "event_id", "type", "status", "message", "read_at", "sent_at") for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.status != "suppressed").order_by(Notification.send_after.desc()).limit(100))]}


@router.post("/notifications/{notification_id}/read")
def read_notification(notification_id: uuid.UUID, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if not n:
        fail(404, "not_found", "Уведомление не найдено")
    if n.user_id != user.id:
        fail(403, "forbidden", "Чужое уведомление")
    n.read_at = n.read_at or now()
    db.commit()
    return data(n, "id", "read_at")


@router.get("/events/{event_id}/feedback")
def feedback_list(event_id: uuid.UUID, db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if not event or event.status != "completed":
        fail(404, "not_found", "Отзывы недоступны")
    return {"items": [{**data(f, "id", "text", "photo_paths"), "name": db.get(User, f.user_id).name} for f in db.scalars(select(Feedback).where(Feedback.event_id == event_id))]}


@router.post("/events/{event_id}/feedback", status_code=201)
def add_feedback(event_id: uuid.UUID, body: FeedbackInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if not event or event.status != "completed":
        fail(409, "event_unavailable", "Отзывы пока недоступны")
    participant = db.scalar(select(Participation).where(Participation.event_id == event_id, Participation.user_id == user.id, Participation.status == "attended"))
    if not participant:
        fail(403, "forbidden", "Только подтверждённый участник может оставить отзыв")
    if db.scalar(select(Feedback.id).where(Feedback.event_id == event_id, Feedback.user_id == user.id)):
        fail(409, "feedback_exists", "Отзыв уже есть")
    item = Feedback(event_id=event_id, user_id=user.id, text=body.text)
    db.add(item)
    db.commit()
    return data(item, "id", "text", "photo_paths")


@router.put("/events/{event_id}/feedback")
def update_feedback(event_id: uuid.UUID, body: FeedbackInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    item = db.scalar(select(Feedback).where(Feedback.event_id == event_id, Feedback.user_id == user.id))
    if not item:
        fail(404, "not_found", "Ваш отзыв не найден")
    item.text = body.text
    db.commit()
    return data(item, "id", "text", "photo_paths")


def validate_image(file: UploadFile):
    content = file.file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        fail(422, "invalid_file", "Нужен JPEG или PNG до 5 МБ")
    try:
        with Image.open(BytesIO(content)) as image:
            if image.format not in ("JPEG", "PNG"):
                fail(422, "invalid_file", "Нужен JPEG или PNG до 5 МБ")
            if image.width * image.height > 30_000_000:
                fail(422, "invalid_file", "Слишком большое изображение")
            image.load()
            image_format = image.format
            clean = image.convert("RGB") if image_format == "JPEG" else image.copy()
            output = BytesIO()
            clean.save(output, format=image_format)
            content = output.getvalue()
            if len(content) > 5 * 1024 * 1024:
                fail(422, "invalid_file", "После обработки файл превышает 5 МБ")
            extension = ".jpg" if image_format == "JPEG" else ".png"
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        fail(422, "invalid_file", "Нужен JPEG или PNG до 5 МБ")
    return content, extension


def store_image(content: bytes, extension: str):
    folder = Path(os.getenv("UPLOAD_DIR", "/data/uploads"))
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4()}{extension}"
    (folder / name).write_bytes(content)
    return name


@router.post("/events/{event_id}/feedback/photos")
def add_feedback_photos(event_id: uuid.UUID, files: list[UploadFile] = File(...), user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    item = db.scalar(select(Feedback).where(Feedback.event_id == event_id, Feedback.user_id == user.id))
    if not item:
        fail(403, "forbidden", "Сначала добавьте свой отзыв")
    if len(files) + len(item.photo_paths) > 2:
        fail(422, "invalid_files", "Не больше двух фото")
    validated = [validate_image(file) for file in files]
    paths = list(item.photo_paths)
    for content, extension in validated:
        paths.append(store_image(content, extension))
    item.photo_paths = paths
    db.commit()
    return data(item, "id", "photo_paths")


@router.post("/events/{event_id}/photos")
def add_event_photo(event_id: uuid.UUID, kind: str, file: UploadFile = File(...), user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    owned_event(db, event_id, user)
    if kind not in ("before", "after"):
        fail(422, "invalid_fields", "Укажите before или after")
    content, extension = validate_image(file)
    path = store_image(content, extension)
    item = EventPhoto(event_id=event_id, kind=kind, path=path)
    db.add(item)
    db.commit()
    return data(item, "id", "kind", "path")


@router.get("/events/{event_id}/photos")
def event_photos(event_id: uuid.UUID, db: Session = Depends(get_db)):
    event = db.get(Event, event_id)
    if not event or event.status == "draft":
        fail(404, "not_found", "Событие не найдено")
    return {"items": [data(photo, "id", "kind", "path") for photo in db.scalars(select(EventPhoto).where(EventPhoto.event_id == event_id))]}


@router.get("/admin/users")
def admin_users(email: str | None = None, user: User = Depends(require_user), db: Session = Depends(get_db)):
    admin(user)
    query = select(User)
    if email:
        query = query.where(User.email.ilike(f"%{email}%"))
    return {"items": [data(u, "id", "email", "name", "role", "expert_permission", "analytics_permission") for u in db.scalars(query.limit(100))]}


@router.patch("/admin/users/{user_id}/permissions")
def permissions(user_id: uuid.UUID, body: PermissionsInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    target = db.get(User, user_id)
    if not target:
        fail(404, "not_found", "Пользователь не найден")
    if body.role not in ("participant", "organizer", "partner", "admin"):
        fail(422, "invalid_fields", "Неизвестная роль")
    if target.role == "admin" and body.role != "admin" and db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.active.is_(True))) <= 1:
        fail(409, "last_admin", "Нельзя снять последнего администратора")
    target.role, target.expert_permission, target.analytics_permission = body.role, body.expert_permission, body.analytics_permission
    db.commit()
    return data(target, "id", "role", "expert_permission", "analytics_permission")


@router.get("/admin/partners")
def admin_partners(user: User = Depends(require_user), db: Session = Depends(get_db)):
    admin(user)
    return {"items": [data(p, "id", "name", "public_contact", "operator_user_id", "active") for p in db.scalars(select(Partner))]}


@router.post("/admin/partners", status_code=201)
def create_partner(body: PartnerInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    if body.operator_user_id and (not db.get(User, body.operator_user_id) or db.get(User, body.operator_user_id).role != "partner"):
        fail(422, "invalid_fields", "Оператор должен иметь роль партнёра")
    item = Partner(**body.model_dump())
    db.add(item)
    db.commit()
    return data(item, "id", "name", "public_contact", "operator_user_id", "active")


@router.patch("/admin/partners/{partner_id}")
def patch_partner(partner_id: uuid.UUID, body: PartnerInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    item = db.get(Partner, partner_id)
    if not item:
        fail(404, "not_found", "Партнёр не найден")
    if body.operator_user_id and (not db.get(User, body.operator_user_id) or db.get(User, body.operator_user_id).role != "partner"):
        fail(422, "invalid_fields", "Оператор должен иметь роль партнёра")
    for key, value in body.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return data(item, "id", "name", "public_contact", "operator_user_id", "active")


@router.get("/admin/offers")
def admin_offers(user: User = Depends(require_user), db: Session = Depends(get_db)):
    admin(user)
    return {"items": [data(o, "id", "partner_id", "title", "description", "price", "stock", "expires_at", "active", "is_demo") for o in db.scalars(select(Offer))]}


@router.post("/admin/offers", status_code=201)
def create_offer(body: OfferInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    if not db.get(Partner, body.partner_id):
        fail(422, "invalid_fields", "Партнёр не найден")
    item = Offer(**body.model_dump())
    db.add(item)
    db.commit()
    return data(item, "id", "title", "price", "stock", "active")


@router.patch("/admin/offers/{offer_id}")
def patch_offer(offer_id: uuid.UUID, body: OfferInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    item = db.scalar(select(Offer).where(Offer.id == offer_id).with_for_update())
    if not item:
        fail(404, "not_found", "Предложение не найдено")
    if not db.get(Partner, body.partner_id):
        fail(422, "invalid_fields", "Партнёр не найден")
    for key, value in body.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return data(item, "id", "title", "price", "stock", "active")


@router.get("/partner/offers")
def partner_offers(user: User = Depends(require_user), db: Session = Depends(get_db)):
    if user.role not in ("partner", "admin"):
        fail(403, "forbidden", "Недостаточно прав")
    query = select(Offer).join(Partner, Partner.id == Offer.partner_id)
    if user.role != "admin":
        query = query.where(Partner.operator_user_id == user.id)
    return {"items": [data(o, "id", "title", "description", "price", "stock", "active") for o in db.scalars(query)]}


@router.patch("/partner/offers/{offer_id}")
def partner_patch_offer(offer_id: uuid.UUID, body: dict, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    if set(body) - {"description", "stock"}:
        fail(422, "invalid_fields", "Можно менять только описание и остаток")
    item = db.scalar(select(Offer).where(Offer.id == offer_id).with_for_update())
    partner = db.get(Partner, item.partner_id) if item else None
    if not item:
        fail(404, "not_found", "Предложение не найдено")
    if partner.operator_user_id != user.id and user.role != "admin":
        fail(403, "forbidden", "Чужое предложение")
    if "description" in body:
        if not isinstance(body["description"], str) or len(body["description"].strip()) < 5:
            fail(422, "invalid_fields", "Описание слишком короткое")
        item.description = body["description"].strip()
    if "stock" in body:
        if not isinstance(body["stock"], int) or body["stock"] < 0:
            fail(422, "invalid_fields", "Остаток не может быть отрицательным")
        item.stock = body["stock"]
    db.commit()
    return data(item, "id", "description", "stock")


@router.post("/admin/redemptions/{redemption_id}/refund")
def refund(redemption_id: uuid.UUID, body: RefundInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    found = db.get(Redemption, redemption_id)
    if not found:
        fail(404, "not_found", "Обмен не найден")
    db.scalar(select(User).where(User.id == found.user_id).with_for_update())
    offer = db.scalar(select(Offer).where(Offer.id == found.offer_id).with_for_update())
    item = db.scalar(select(Redemption).where(Redemption.id == redemption_id).with_for_update().execution_options(populate_existing=True))
    if item.status == "refunded":
        return redemption_data(db, item)
    if item.status != "issued":
        fail(409, "already_redeemed", "Погашенный код нельзя вернуть")
    item.status, item.refund_reason = "refunded", body.reason
    offer.stock += 1
    db.add(PointEntry(user_id=item.user_id, delta=item.price_snapshot, kind="refund", operation_key=f"refund:{item.id}", redemption_id=item.id, reason=body.reason))
    db.commit()
    return redemption_data(db, item)


@router.get("/admin/articles")
def admin_articles(user: User = Depends(require_user), db: Session = Depends(get_db)):
    admin(user)
    return {"items": [data(a, "id", "title", "text", "category", "sources", "published") for a in db.scalars(select(Article))]}


@router.post("/admin/articles", status_code=201)
def create_article(body: ArticleInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    item = Article(**body.model_dump())
    db.add(item)
    db.commit()
    return data(item, "id", "title", "text", "category", "sources", "published")


@router.patch("/admin/articles/{article_id}")
def patch_article(article_id: uuid.UUID, body: ArticleInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    item = db.get(Article, article_id)
    if not item:
        fail(404, "not_found", "Статья не найдена")
    for key, value in body.model_dump().items():
        setattr(item, key, value)
    db.commit()
    return data(item, "id", "title", "text", "category", "sources", "published")


@router.post("/admin/teams/{team_id}/transfer")
def transfer(team_id: uuid.UUID, body: TransferInput, user: User = Depends(csrf_check), db: Session = Depends(get_db)):
    admin(user)
    team = db.get(Team, team_id)
    member_id = body.user_id
    member = db.get(TeamMember, member_id)
    if not team or not member or member.team_id != team_id:
        fail(422, "invalid_fields", "Пользователь не состоит в команде")
    team.captain_id = member_id
    db.commit()
    return data(team, "id", "captain_id")


@router.get("/organizer/retention")
def retention(from_: datetime = Query(alias="from"), to: datetime = Query(), user: User = Depends(require_user), db: Session = Depends(get_db)):
    if user.role != "admin" and not user.analytics_permission:
        fail(403, "forbidden", "Нет права на аналитику")
    if from_.tzinfo is None or to.tzinfo is None or to <= from_:
        fail(422, "invalid_fields", "Некорректный диапазон")
    first = db.execute(select(Participation.user_id, func.min(Participation.created_at)).group_by(Participation.user_id)).all()
    eligible = [(uid, at) for uid, at in first if from_ <= at < to and at + timedelta(days=14) <= now()]
    returned = 0
    for uid, at in eligible:
        initial = db.scalar(select(Participation.event_id).where(Participation.user_id == uid, Participation.created_at == at).limit(1))
        later = db.scalar(select(Participation.id).where(Participation.user_id == uid, Participation.event_id != initial, Participation.created_at > at, Participation.created_at <= at + timedelta(days=14)).limit(1))
        returned += bool(later)
    return {"n": len(eligible), "returned_n": returned, "rate": round(returned / len(eligible), 4) if eligible else None, "observation_days": 14}
