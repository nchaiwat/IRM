"""
Auth Schemas.
"""

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


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
    group_id: int | None
    group_name: str | None
    allowed_item_groups: str | None = "*"
    permissions: list[PermissionItem]

    model_config = {"from_attributes": True}
