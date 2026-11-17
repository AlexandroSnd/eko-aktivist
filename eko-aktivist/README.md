# Эко Активист

Учебная веб-платформа для экологических акций Екатеринбурга по [исходному документу](docs/specification.docx). Клиент — React + TypeScript, API — FastAPI + SQLAlchemy, данные — PostgreSQL. Интерфейс и API работают через один origin.

## Быстрый запуск

1. Скопируйте `.env.example` в `.env`.
2. Задайте надёжные `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`, `CSRF_SIGNING_KEY` и `REDEMPTION_KEY`. Ключ Fernet создаётся без дополнительных пакетов: `python3 -c 'import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())'`. Для `CSRF_SIGNING_KEY` используйте `openssl rand -hex 32`.
3. Запустите `docker compose up --build -d`. Контейнер API применяет миграцию и создаёт первого администратора.
4. Выполните `docker compose exec api python -m app.cli seed_demo`.
5. Откройте `http://localhost:8080`. Тестовые письма доступны на `http://localhost:8025`, схема API — на `http://localhost:8080/docs`.

Демонстрационный организатор: `organizer@example.com` / значение `DEMO_PASSWORD` (по умолчанию `DemoPassword123!`). Три демонстрационных участника: `volunteer1@example.com` — `volunteer3@example.com` с тем же паролем. Администратор: значения `ADMIN_EMAIL` и `ADMIN_PASSWORD` из `.env`. Тестовые предложения обозначены как учебные.

## Основной путь

Администратор назначает роль организатора через `/admin`. Организатор создаёт черновик в `/organizer/events` и публикует его. Участник находит событие в `/events`, записывается, а после окончания акции организатор подтверждает его вклад. Баллы и измеренные показатели появляются в `/profile`. Обмен происходит в `/offers`; партнёр погашает одноразовый код в `/partner`.

## Структура

- `apps/web/src/app` — провайдеры и маршрутизация;
- `apps/web/src/pages` — страницы приложения;
- `apps/web/src/widgets` — составные блоки интерфейса, включая карту;
- `apps/web/src/entities` — доменные UI-компоненты;
- `apps/web/src/shared` — API-клиент и общие UI-компоненты;
- `apps/api/app/models.py` — таблицы и ограничения;
- `apps/api/app/api.py` — доступ, события, участие, баллы, команды и награды;
- `apps/api/app/extra.py` — контент, уведомления и служебные API;
- `apps/api/app/scheduler.py` — напоминания, email и истечение кодов;
- `apps/web/src/main.tsx` — интерфейс и маршруты;
- `docs/COVERAGE.md` — соответствие FR-01–FR-24;
- `docs/ACCEPTANCE.md` — браузерные сценарии и ограничения проверки;
- `docs/IMPLEMENTATION.md` — известные пробелы и шаги до приёмки.

Браузерные сценарии запускаются из `apps/web` командой `npm run test:e2e`. Перед этим запустите API и web, подготовьте миграции и демонстрационные данные; при первой установке скачайте Chromium командой `npx playwright install chromium`.

## Развёртывание

Для публичного стенда настройте DNS, задайте `DOMAIN` в `.env` и запустите `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d`. Caddy получает TLS сертификат, а API использует `PUBLIC_ORIGIN=https://<DOMAIN>` и Secure cookie. Не публикуйте демонстрационные пароли; для публичного пилота отключите или смените демонстрационные аккаунты. PostgreSQL и загруженные фото сохраняются в volumes `postgres_data` и `uploads`.

Резервная копия БД: `docker compose exec -T db pg_dump -U eco eco > eco.sql`. Восстановление на пустой БД: `cat eco.sql | docker compose exec -T db psql -U eco eco`. Фото из volume `uploads` копируются отдельно. Перед реальным пилотом нужен отдельный стенд, проверка SMTP, прав, гонок и производительности.
