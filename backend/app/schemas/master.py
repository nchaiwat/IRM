"""
Item Master and Supplier Master Pydantic Schemas.
"""

from datetime import datetime
from pydantic import BaseModel, EmailStr


class ItemMasterCreate(BaseModel):
    item_code: str
    description: str
    lead_time_days: int = 60
    notify_alert_days: int = 3
    item_group: str | None = "113"


class ItemMasterUpdate(BaseModel):
    description: str | None = None
    lead_time_days: int | None = None
    notify_alert_days: int | None = None
    item_group: str | None = None
    is_new: bool | None = None


class ItemMasterResponse(BaseModel):
    id: int
    item_code: str
    description: str
    lead_time_days: int = 60
    notify_alert_days: int = 3
    item_group: str | None = "113"
    is_new: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class SupplierMasterCreate(BaseModel):
    supplier_code: str
    supplier_name: str
    telephone: str | None = None
    email: EmailStr | None = None
    contact_person: str | None = None
    allow_over_delivery: bool | None = False


class SupplierMasterUpdate(BaseModel):
    supplier_name: str | None = None
    telephone: str | None = None
    email: str | None = None
    contact_person: str | None = None
    allow_over_delivery: bool | None = None
    is_new: bool | None = None


class SupplierMasterResponse(BaseModel):
    id: int
    supplier_code: str
    supplier_name: str
    telephone: str | None = None
    email: str | None = None
    contact_person: str | None = None
    allow_over_delivery: bool = False
    is_new: bool = True
    last_sent_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}
