"""
SystemSetting Schemas.
"""

from datetime import datetime
from pydantic import BaseModel


class SystemSettingItem(BaseModel):
    key: str
    value: str | None
    description: str | None = None
    category: str | None = None
    data_type: str | None = None


class SystemSettingResponse(BaseModel):
    id: int
    key: str
    value: str | None
    description: str | None
    category: str
    data_type: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class SystemSettingsBulkUpdate(BaseModel):
    settings: list[SystemSettingItem]
