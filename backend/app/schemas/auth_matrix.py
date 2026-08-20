"""
AuthMatrix Schemas.
"""

from pydantic import BaseModel


class AuthMatrixEntry(BaseModel):
    group_id: int
    menu_id: int
    can_view: bool = False
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False


class AuthMatrixCell(BaseModel):
    menu_id: int
    menu_name: str
    menu_path: str | None
    parent_id: int | None
    can_view: bool
    can_create: bool
    can_edit: bool
    can_delete: bool


class GroupMatrixRow(BaseModel):
    group_id: int
    group_name: str
    permissions: list[AuthMatrixCell]


class AuthMatrixBulkUpdate(BaseModel):
    entries: list[AuthMatrixEntry]
