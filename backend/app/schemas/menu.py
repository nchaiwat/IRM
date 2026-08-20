"""
Menu Schemas — tree hierarchy for navigation and Admin sub-menus.
"""

from typing import Optional
from pydantic import BaseModel


class MenuResponse(BaseModel):
    id: int
    name: str
    path: str | None
    icon: str | None
    sort_order: int
    parent_id: int | None
    is_active: bool
    children: list["MenuResponse"] = []

    model_config = {"from_attributes": True}


MenuResponse.model_rebuild()
