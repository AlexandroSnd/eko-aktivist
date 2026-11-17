from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Register(Strict):
    email: EmailStr
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=10)


class Login(Strict):
    email: EmailStr
    password: str


class ProfilePatch(Strict):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    city: str | None = Field(default=None, min_length=2, max_length=120)


class EventInput(Strict):
    title: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=20, max_length=3000)
    type: str
    city: str = Field(default="Екатеринбург", min_length=2, max_length=120)
    address: str = Field(min_length=5, max_length=300)
    lat: Decimal = Field(ge=-90, le=90)
    lon: Decimal = Field(ge=-180, le=180)
    start_at: datetime
    end_at: datetime
    capacity: int = Field(ge=1, le=500)
    contact: str = Field(min_length=5, max_length=200)
    inventory: str = Field(default="", max_length=500)
    competition_enabled: bool = False

    @field_validator("type")
    @classmethod
    def valid_type(cls, value):
        if value not in ("cleanup", "recycling", "planting", "lecture", "quest"):
            raise ValueError("Неизвестный тип события")
        return value

    @model_validator(mode="after")
    def check_dates(self):
        if self.start_at.tzinfo is None or self.end_at.tzinfo is None or self.end_at <= self.start_at:
            raise ValueError("Укажите корректное время с часовым поясом")
        return self


class EventPatch(Strict):
    description: str | None = Field(default=None, min_length=20, max_length=3000)
    inventory: str | None = Field(default=None, max_length=500)
    title: str | None = Field(default=None, min_length=5, max_length=120)
    type: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    lat: Decimal | None = Field(default=None, ge=-90, le=90)
    lon: Decimal | None = Field(default=None, ge=-180, le=180)
    city: str | None = None
    address: str | None = None
    capacity: int | None = Field(default=None, ge=1, le=500)
    contact: str | None = None
    competition_enabled: bool | None = None

    @field_validator("type")
    @classmethod
    def valid_type(cls, value):
        if value is not None and value not in ("cleanup", "recycling", "planting", "lecture", "quest"):
            raise ValueError("Неизвестный тип события")
        return value


class CancelEvent(Strict):
    reason: str = Field(min_length=5, max_length=500)


class JoinEvent(Strict):
    team_id: UUID | None = None


class ResultInput(Strict):
    status: str
    hours: Decimal | None = Field(default=None, ge=0, le=24, decimal_places=2)
    waste_kg: Decimal | None = Field(default=None, ge=0, le=1000, decimal_places=2)
    trees: int | None = Field(default=None, ge=0, le=1000)
    reason: str | None = Field(default=None, min_length=5, max_length=500)


class TeamInput(Strict):
    name: str = Field(min_length=3, max_length=60)
    description: str = Field(default="", max_length=500)


class RedemptionInput(Strict):
    offer_id: UUID


class OfferInput(Strict):
    partner_id: UUID
    title: str = Field(min_length=2, max_length=150)
    description: str = Field(min_length=5)
    price: int = Field(ge=1, le=10000)
    stock: int = Field(ge=0)
    expires_at: datetime
    active: bool = True
    is_demo: bool = True

    @field_validator("expires_at")
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None:
            raise ValueError("Укажите часовой пояс")
        return value


class PartnerInput(Strict):
    name: str = Field(min_length=2, max_length=120)
    public_contact: str = Field(min_length=5, max_length=200)
    operator_user_id: UUID | None = None


class ArticleInput(Strict):
    title: str = Field(min_length=5, max_length=150)
    text: str = Field(min_length=50, max_length=10000)
    category: str = Field(min_length=2, max_length=80)
    sources: list[str] = []
    published: bool = False

    @model_validator(mode="after")
    def sources_for_publication(self):
        if self.published and not self.sources:
            raise ValueError("Для публикации укажите источник")
        if any(not source.startswith(("https://", "http://")) for source in self.sources):
            raise ValueError("Источник должен быть URL")
        return self


class QuestionInput(Strict):
    category: str = Field(min_length=2, max_length=80)
    text: str = Field(min_length=10, max_length=2000)


class AnswerInput(Strict):
    answer: str = Field(min_length=10, max_length=5000)


class SubscriptionInput(Strict):
    city: str = Field(min_length=2, max_length=120)
    types: list[str] = []

    @field_validator("types")
    @classmethod
    def known_types(cls, value):
        valid = {"cleanup", "recycling", "planting", "lecture", "quest"}
        if len(set(value)) != len(value) or any(item not in valid for item in value):
            raise ValueError("Неизвестный или повторяющийся тип")
        return value


class FeedbackInput(Strict):
    text: str = Field(min_length=1, max_length=1000)


class PermissionsInput(Strict):
    role: str
    expert_permission: bool = False
    analytics_permission: bool = False


class RefundInput(Strict):
    reason: str = Field(min_length=5, max_length=500)


class RedeemCode(Strict):
    code: str = Field(min_length=10, max_length=200)


class TransferInput(Strict):
    user_id: UUID
