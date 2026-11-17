import os
import sys
from datetime import timedelta

from sqlalchemy import select

from .core import password_hash
from .db import SessionLocal
from .models import Article, Badge, Event, Offer, Partner, Participation, PointEntry, Team, TeamMember, User, now


def bootstrap_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    if len(password) < 10:
        raise ValueError("ADMIN_PASSWORD must have at least 10 characters")
    with SessionLocal.begin() as db:
        if db.scalar(select(User.id).where(User.email == email)):
            return
        db.add(User(email=email, name="Администратор", password_hash=password_hash.hash(password), role="admin"))


def seed_demo():
    email = os.getenv("DEMO_ORGANIZER_EMAIL", "organizer@example.com")
    password = os.getenv("DEMO_PASSWORD", "DemoPassword123!")
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(email=email, name="Экоцентр Екатеринбурга", city="Екатеринбург", role="organizer", password_hash=password_hash.hash(password))
            db.add(user)
            db.flush()
        volunteers = []
        for i in range(3):
            volunteer_email = f"volunteer{i + 1}@example.com"
            volunteer = db.scalar(select(User).where(User.email == volunteer_email))
            if not volunteer:
                volunteer = User(email=volunteer_email, name=f"Волонтёр {i + 1}", city="Екатеринбург", password_hash=password_hash.hash(password))
                db.add(volunteer)
                db.flush()
            volunteers.append(volunteer)
        descriptions = [
            ("Уборка набережной Исети", "cleanup", "Набережная Исети, 12", 56.832, 60.606),
            ("Сбор вторсырья на Вайнера", "recycling", "улица Вайнера, 10", 56.835, 60.596),
            ("Посадка деревьев в парке", "planting", "ЦПКиО, Мичурина, 230", 56.813, 60.639),
            ("Лекция о сортировке отходов", "lecture", "улица Малышева, 51", 56.837, 60.613),
            ("Экологический квест", "quest", "Плотинка, площадь Труда", 56.839, 60.607),
        ]
        for index in range(10):
            title, kind, address, lat, lon = descriptions[index % 5]
            name = f"{title} #{index + 1}"
            if db.scalar(select(Event.id).where(Event.title == name)):
                continue
            start = now() + timedelta(days=index + 3)
            db.add(Event(organizer_id=user.id, title=name, description="Присоединяйтесь к экологической акции в Екатеринбурге. Опыт не нужен; организатор выдаст инструкции на месте.", type=kind, city="Екатеринбург", address=address, lat=lat, lon=lon, start_at=start, end_at=start + timedelta(hours=3), capacity=25, contact="eco@example.com", inventory="Перчатки и удобная одежда", status="published", competition_enabled=index % 2 == 0))
        completed = db.scalar(select(Event).where(Event.title == "Учебная завершённая акция"))
        if not completed:
            start = now() - timedelta(days=5)
            completed = Event(organizer_id=user.id, title="Учебная завершённая акция", description="Тестовая карточка для демонстрации истории и отзывов в приложении.", type="cleanup", city="Екатеринбург", address="Центральный парк, 1", lat=56.813, lon=60.639, start_at=start, end_at=start + timedelta(hours=2), capacity=20, contact="eco@example.com", inventory="Перчатки", status="completed")
            db.add(completed)
            db.flush()
        if not db.scalar(select(Participation.id).where(Participation.event_id == completed.id, Participation.user_id == volunteers[0].id)):
            p = Participation(user_id=volunteers[0].id, event_id=completed.id, status="attended", hours=2, base_points=20, revision=1, created_at=completed.start_at - timedelta(days=1), confirmed_at=completed.end_at)
            db.add(p)
            db.flush()
            db.add(PointEntry(user_id=volunteers[0].id, delta=20, kind="participation", operation_key=f"seed:participation:{p.id}", participation_id=p.id, event_id=completed.id))
        if not db.scalar(select(PointEntry.id).where(PointEntry.operation_key == f"organizer:{completed.id}:{user.id}")):
            db.add(PointEntry(user_id=user.id, delta=30, kind="organizer", operation_key=f"organizer:{completed.id}:{user.id}", event_id=completed.id))
        if not db.scalar(select(Badge.id).where(Badge.user_id == volunteers[0].id, Badge.code == "first_participation")):
            db.add(Badge(user_id=volunteers[0].id, code="first_participation"))
        if not db.scalar(select(Badge.id).where(Badge.user_id == user.id, Badge.code == "first_organization")):
            db.add(Badge(user_id=user.id, code="first_organization"))
        open_past = db.scalar(select(Event).where(Event.title == "Учебная акция для подтверждения"))
        if not open_past:
            start = now() - timedelta(days=2)
            open_past = Event(organizer_id=user.id, title="Учебная акция для подтверждения", description="Прошедшая акция с открытым подтверждением результатов для демонстрации работы организатора.", type="cleanup", city="Екатеринбург", address="Парк Маяковского, 1", lat=56.813, lon=60.639, start_at=start, end_at=start + timedelta(hours=2), capacity=20, contact="eco@example.com", inventory="Перчатки", status="published")
            db.add(open_past)
            db.flush()
        if not db.scalar(select(Participation.id).where(Participation.event_id == open_past.id, Participation.user_id == volunteers[1].id)):
            db.add(Participation(user_id=volunteers[1].id, event_id=open_past.id, status="registered", created_at=open_past.start_at - timedelta(days=1)))
        if not db.scalar(select(Team.id).limit(1)):
            for i in range(3):
                team = Team(name=f"Эко команда {i + 1}", description="Команда для совместного участия в экологических акциях", captain_id=volunteers[i].id)
                db.add(team)
                db.flush()
                db.add(TeamMember(user_id=volunteers[i].id, team_id=team.id))
        if not db.scalar(select(Partner.id).limit(1)):
            for name in ("Эко магазин", "Зелёное кафе"):
                partner = Partner(name=name, public_contact="partner@example.com")
                db.add(partner)
                db.flush()
                for i in range(2 if name == "Эко магазин" else 3):
                    db.add(Offer(partner_id=partner.id, title=f"Учебный бонус {name} #{i + 1}", description="Демонстрационное предложение. Реальный партнёр пока не подтверждён.", price=20 + i * 20, stock=10, expires_at=now() + timedelta(days=60), is_demo=True))
        if not db.scalar(select(Article.id).limit(1)):
            db.add(Article(title="Как подготовиться к экологической акции", text="Выбирайте удобную одежду, проверьте место встречи и возьмите воду. Уточняйте условия в карточке события. После акции организатор подтвердит ваш вклад и баллы.", category="Подготовка", sources=["https://www.un.org/sustainabledevelopment/"], published=True))


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in ("bootstrap_admin", "seed_demo"):
        raise SystemExit("Usage: python -m app.cli bootstrap_admin|seed_demo")
    globals()[sys.argv[1]]()
