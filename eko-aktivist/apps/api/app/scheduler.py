import os
import smtplib
import time
from datetime import timedelta
from email.message import EmailMessage

from sqlalchemy import select

from .db import SessionLocal
from .models import Event, Notification, Offer, Participation, PointEntry, Redemption, User, now


def tick():
    with SessionLocal.begin() as db:
        upcoming = db.execute(select(Participation, Event).join(Event, Event.id == Participation.event_id).where(Participation.status == "registered", Event.status == "published", Event.start_at > now(), Event.start_at <= now() + timedelta(hours=24))).all()
        for p, event in upcoming:
            key = f"reminder:{p.id}"
            if not db.scalar(select(Notification.id).where(Notification.dedupe_key == key)):
                db.add(Notification(user_id=p.user_id, event_id=event.id, type="reminder", message=f"Завтра акция: {event.title}, {event.address}", dedupe_key=key))
        expired = db.scalars(select(Redemption.id).where(Redemption.status == "issued", Redemption.expires_at <= now()).limit(100)).all()
        for item_id in expired:
            snapshot = db.get(Redemption, item_id)
            db.scalar(select(User).where(User.id == snapshot.user_id).with_for_update())
            offer = db.scalar(select(Offer).where(Offer.id == snapshot.offer_id).with_for_update())
            item = db.scalar(select(Redemption).where(Redemption.id == item_id).with_for_update().execution_options(populate_existing=True))
            if item.status != "issued":
                continue
            item.status, item.refund_reason = "refunded", "Срок кода истёк"
            offer.stock += 1
            db.add(PointEntry(user_id=item.user_id, delta=item.price_snapshot, kind="refund", operation_key=f"refund:{item.id}", redemption_id=item.id, reason=item.refund_reason))

    with SessionLocal.begin() as db:
        due = db.scalars(select(Notification).where(Notification.status == "pending", Notification.sent_at.is_(None), Notification.send_after <= now(), Notification.attempts < 3).with_for_update(skip_locked=True).limit(100)).all()
        for note in due:
            if note.type == "reminder":
                p = db.scalar(select(Participation).where(Participation.user_id == note.user_id, Participation.event_id == note.event_id))
                event = db.get(Event, note.event_id)
                if not p or p.status != "registered" or not event or event.status != "published":
                    note.status = "suppressed"
                    note.sent_at = now()
                    continue
            user = db.get(User, note.user_id)
            message = EmailMessage()
            message["From"] = os.getenv("SMTP_FROM", "eco@localhost")
            message["To"] = user.email
            message["Subject"] = "Эко Активист — уведомление"
            message.set_content(note.message)
            try:
                with smtplib.SMTP(os.getenv("SMTP_HOST", "mailpit"), int(os.getenv("SMTP_PORT", "1025")), timeout=10) as smtp:
                    smtp.send_message(message)
                note.status = "sent"
                note.sent_at = now()
            except (OSError, smtplib.SMTPException):
                note.attempts += 1
                if note.attempts >= 3:
                    note.status = "failed"
                note.send_after = now() + timedelta(minutes=[1, 5, 15][min(note.attempts - 1, 2)])


if __name__ == "__main__":
    while True:
        try:
            tick()
        except Exception:
            import logging
            logging.exception("Scheduler tick failed")
        time.sleep(60)
