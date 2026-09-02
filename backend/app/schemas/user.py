"""
User Schemas.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    email: EmailStr
    department: str | None = None
    use_ad_auth: bool = False
    telegram_chat_id: str | None = None
    group_id: int | None = None
    allowed_item_groups: str | None = "*"
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    department: str | None = None
    use_ad_auth: bool | None = None
    telegram_chat_id: str | None = None
    group_id: int | None = None
    allowed_item_groups: str | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str


class GroupMinimal(BaseModel):
    id: int
    name: str
    allowed_item_groups: str | None = "*"
    default_page: str | None = "/dashboard"

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    department: str | None = None
    use_ad_auth: bool = False
    telegram_chat_id: str | None = None
    group_id: int | None
    group: GroupMinimal | None
    allowed_item_groups: str | None = "*"
    is_active: bool
    last_login_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
