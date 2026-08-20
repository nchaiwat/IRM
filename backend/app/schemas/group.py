"""
Group Schemas.
"""

from datetime import datetime
from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    description: str | None = None
    is_active: bool = True


class GroupUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    user_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
