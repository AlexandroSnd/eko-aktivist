from logging.config import fileConfig

from alembic import context

from app.db import Base, DATABASE_URL
from app import models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", DATABASE_URL)
target_metadata = Base.metadata


def run_migrations_online():
    from app.db import engine
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
