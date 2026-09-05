"""
PO Pydantic Schemas with Audit Trail fields.
"""

from datetime import datetime
from pydantic import BaseModel


class SubItemCreate(BaseModel):
    estimate_date: datetime
    quantity: float


class SubItemResponse(BaseModel):
    id: int
    po_item_id: int
    estimate_date: datetime
    quantity: float
    updated_by_name: str | None = None
    updated_by_type: str | None = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class POItemAuditLogResponse(BaseModel):
    id: int
    action: str
    changes_detail: str
    changed_by_name: str
    changed_by_type: str
    changed_at: datetime

    model_config = {"from_attributes": True}


class POItemUpdate(BaseModel):
    estimate_date: datetime | None = None
    estimate_qty: float | None = None
    sub_items: list[SubItemCreate] = []
    force_override: bool = False
    override_reason: str | None = None


class POItemResponse(BaseModel):
    id: int
    po_header_id: int
    line_num: int = 0
    po_number: str
    po_date: datetime
    supplier_code: str
    supplier_name: str
    buyer_name: str
    item_code: str
    item_name: str
    quantity: float
    unit: str
    received_qty: float
    remaining_qty: float
    due_date: datetime | None = None
    item_group: str | None = None
    estimate_date: datetime | None
    estimate_qty: float | None
    allow_over_delivery: bool = False
    status: str
    is_new: bool = True
    created_at: datetime | None = None
    closed_at: datetime | None = None
    locked_by: str | None = None
    lock_expires_at: datetime | None = None
    updated_by_name: str | None
    updated_by_type: str | None
    updated_at: datetime
    sub_items: list[SubItemResponse] = []
    audit_logs: list[POItemAuditLogResponse] = []

    model_config = {"from_attributes": True}
