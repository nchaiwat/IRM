"""
Auth Schemas.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str
    password: str
    # Layer 2 Decoy Honeypot Trap (Bot Defense)
    corporate_fax: str | None = None
    security_honey: str | None = None
    # Layer 3 Submission Velocity Guard (Epoch Milliseconds)
    form_render_ts: int | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False
    days_until_password_expiry: int | None = None


class ChangeLocalPasswordRequest(BaseModel):
    old_password: str
    new_password: str
    confirm_password: str | None = None


class PermissionItem(BaseModel):
    menu_id: int
    menu_name: str
    menu_path: str | None
    can_view: bool
    can_create: bool
    can_edit: bool
    can_delete: bool


class UserMeResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    telegram_chat_id: str | None = None
    telegram_inbound_notify: bool = True
    department: str | None = None
    use_ad_auth: bool = False
    group_id: int | None
    group_name: str | None
    allowed_item_groups: str | None = "*"
    default_page: str | None = "/dashboard"
    permissions: list[PermissionItem]
    must_change_password: bool = False
    days_until_password_expiry: int | None = None
    password_changed_at: datetime | None = None

    model_config = {"from_attributes": True}
