"""
Supplier Master Router — CRUD, Accept New Record, Cryptographic Token Generation, Real SMTP Email Delivery, and Fail-Safe Auto-Seeding.
"""

from datetime import datetime, timezone, timedelta
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.master import SupplierMaster
from app.models.supplier_token import SupplierPortalToken
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.schemas.master import SupplierMasterCreate, SupplierMasterResponse, SupplierMasterUpdate

router = APIRouter(prefix="/api/suppliers", tags=["Supplier Master"])


def calculate_prd_expiry_date(now_dt: datetime) -> datetime:
    """
    PRD Expiration Rules:
    - Monday (0), Tuesday (1), Wednesday (2) -> Expires Wednesday 23:59:59
    - Thursday (3), Friday (4), Saturday (5), Sunday (6) -> Expires Sunday 23:59:59
    """
    weekday = now_dt.weekday()
    if weekday <= 2:
        days_ahead = 2 - weekday
        return (now_dt + timedelta(days=days_ahead)).replace(hour=23, minute=59, second=59, microsecond=0)
    else:
        days_ahead = 6 - weekday
        return (now_dt + timedelta(days=days_ahead)).replace(hour=23, minute=59, second=59, microsecond=0)


async def get_or_create_supplier_token(db: AsyncSession, supplier_code: str) -> SupplierPortalToken:
    """
    Invalidate all previous active tokens for this supplier and create a fresh cryptographic token.
    Enforces that opening an older email link will be rejected / expired immediately.
    """
    now_dt = datetime.now(timezone.utc)
    target_expiry = calculate_prd_expiry_date(now_dt)

    # 1. Invalidate / Revoke all old active tokens for this supplier
    stmt_revoke = (
        select(SupplierPortalToken)
        .where(SupplierPortalToken.supplier_code == supplier_code)
        .where(SupplierPortalToken.is_submitted == False)
    )
    old_tokens = (await db.execute(stmt_revoke)).scalars().all()
    for old_tok in old_tokens:
        old_tok.expires_at = now_dt - timedelta(seconds=1)
        old_tok.is_submitted = True
        db.add(old_tok)

    # 2. Generate a brand new cryptographic token
    raw_token = f"tok_{secrets.token_hex(20)}"
    token_obj = SupplierPortalToken(
        token=raw_token,
        supplier_code=supplier_code,
        po_number=None,
        is_submitted=False,
        expires_at=target_expiry,
    )
    db.add(token_obj)
    await db.commit()
    await db.refresh(token_obj)

    return token_obj


@router.get("", response_model=list[SupplierMasterResponse])
async def list_suppliers(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List all supplier masters. Guaranteed inline auto-seed if empty."""
    stmt = select(SupplierMaster).order_by(SupplierMaster.supplier_code.asc())
    result = await db.execute(stmt)
    suppliers = result.scalars().all()

    if not suppliers:
        suppliers_seed = [
            ("VD-0004", "บริษัท กรีนเทคพลัส อินเตอร์กรุ๊ป จำกัด", "n.chaiwat@gmail.com", "02-123-4567", "คุณสมชาย"),
            ("VD-0123", "บริษัท ริเวลเทค โปรดักส์ จำกัด", "info@riveltech.co.th", "02-987-6543", "คุณวิชัย"),
            ("VD-0021", "บริษัท ไทรพอยท์ อินเตอร์เทรดดิ้ง จำกัด", "contact@tripoint.co.th", "02-555-1234", "คุณสุรชัย"),
            ("VD-0088", "บริษัท คินลอง ฮาร์ดแวร์ (ประเทศไทย) จำกัด", "sales@kinlong.co.th", "02-777-8888", "คุณกิตติ"),
            ("VD-0120", "ห้างหุ้นส่วนจำกัด กระจกคิ้วเชียงเซ้ง", "sales@chiangseng.co.th", "02-444-3333", "คุณเชียง"),
            ("VD-0558", "บริษัท คิม แซนด์ อินเตอร์เนชั่นแนล จำกัด", "info@kimsand.co.th", "02-222-1111", "คุณคิม"),
            ("VD-0706", "บริษัท ฮอสเด็ค (ประเทศไทย) จำกัด", "info@hosdeck.co.th", "02-333-2222", "คุณฮอส"),
            ("VD-0044", "บริษัท ซี เจ ควิก โปรดักส์ จำกัด", "sales@cjquick.co.th", "02-666-5555", "คุณซีเจ"),
        ]
        for scode, sname, semail, sphone, scontact in suppliers_seed:
            db.add(SupplierMaster(
                supplier_code=scode,
                supplier_name=sname,
                email=semail,
                telephone=sphone,
                contact_person=scontact,
                is_new=True,
            ))
        await db.commit()
        result = await db.execute(stmt)
        suppliers = result.scalars().all()

    return suppliers


@router.post("", response_model=SupplierMasterResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    data: SupplierMasterCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create a new supplier master."""
    existing = await db.execute(select(SupplierMaster).where(SupplierMaster.supplier_code == data.supplier_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier Code already exists")

    supplier = SupplierMaster(
        supplier_code=data.supplier_code,
        supplier_name=data.supplier_name,
        telephone=data.telephone,
        email=data.email,
        contact_person=data.contact_person,
        is_new=True,
    )
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.put("/{supplier_id}", response_model=SupplierMasterResponse)
async def update_supplier(
    supplier_id: int,
    data: SupplierMasterUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Update supplier information (email, phone, contact person, is_new)."""
    stmt = select(SupplierMaster).where(SupplierMaster.id == supplier_id)
    supplier = (await db.execute(stmt)).scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    if data.supplier_name:
        supplier.supplier_name = data.supplier_name
    if data.telephone is not None:
        supplier.telephone = data.telephone
    if data.email is not None:
        supplier.email = data.email
    if data.contact_person is not None:
        supplier.contact_person = data.contact_person
    if data.allow_over_delivery is not None:
        supplier.allow_over_delivery = data.allow_over_delivery
    if data.is_new is not None:
        supplier.is_new = data.is_new

    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.post("/{supplier_id}/accept", response_model=SupplierMasterResponse)
@router.put("/{supplier_id}/accept", response_model=SupplierMasterResponse)
async def accept_new_supplier(
    supplier_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Accept a new Supplier Master record, clearing the 'is_new' badge."""
    stmt = select(SupplierMaster).where(SupplierMaster.id == supplier_id)
    supplier = (await db.execute(stmt)).scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    supplier.is_new = False
    await db.commit()
    await db.refresh(supplier)
    return supplier


@router.post("/{supplier_id}/token")
async def generate_token_for_supplier(
    supplier_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Generate or retrieve cryptographic Portal Token for a supplier."""
    supplier = (await db.execute(select(SupplierMaster).where(SupplierMaster.id == supplier_id))).scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    stmt_base = select(SystemSetting).where(SystemSetting.key == "app_base_url")
    base_setting = (await db.execute(stmt_base)).scalar_one_or_none()
    base_url = base_setting.value.strip().rstrip("/") if base_setting and base_setting.value else "https://irm.windowasia.com"
    if "irm.windowasia.com" in base_url and base_url.startswith("http://"):
        base_url = base_url.replace("http://", "https://")

    return {
        "token": token_obj.token,
        "expires_at": token_obj.expires_at.strftime("%d/%m/%Y %H:%M:%S"),
        "portal_url": f"{base_url}/supplier/portal/{token_obj.token}",
    }


from app.services.email_service import (
    calculate_prd_expiry_date,
    get_or_create_supplier_token,
    send_single_supplier_email,
    send_batch_portal_emails,
)


@router.post("/{supplier_id}/send-portal-email")
async def send_portal_email(
    supplier_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Send Supplier Portal Cryptographic Token Link with No-Reply banner and Item Lock."""
    supplier = (await db.execute(select(SupplierMaster).where(SupplierMaster.id == supplier_id))).scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier not found")

    if not supplier.email or "@" not in supplier.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supplier does not have a valid Email address configured")

    smtp_keys = [
        "smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_use_tls", "smtp_from_name"
    ]
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.key.in_(smtp_keys)))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    try:
        now_dt = datetime.now(timezone.utc)
        res = await send_single_supplier_email(db, supplier, s_map, now_dt)
        if res.get("status") == "skipped":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("reason"))
        return {"message": f"ส่ง Email แจ้งลิงก์ Portal หา {supplier.supplier_name} ({supplier.email}) สำเร็จเรียบร้อยแล้ว"}
    except Exception as e:
        print(f"❌ Real SMTP Email Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ส่ง Email ล้มเหลว: {str(e)}",
        )


@router.post("/send-all-portal-emails")
async def broadcast_portal_emails(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Manual trigger to batch broadcast portal links to all active suppliers (Rate-limited, max 100)."""
    try:
        result = await send_batch_portal_emails(db, max_suppliers=100)
        return {
            "message": f"กระจายส่ง Email ให้ Supplier สำเร็จ {result['sent_count']}/{result['total_attempted']} ราย (ล้มเหลว {result['failed_count']} ราย)",
            "details": result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"การกระจายส่ง Email ล้มเหลว: {str(e)}",
        )


from pydantic import BaseModel

class SupplierBulkItem(BaseModel):
    supplier_code: str
    supplier_name: str | None = None
    email: str | None = None
    telephone: str | None = None
    contact_person: str | None = None
    allow_over_delivery: bool | None = None

class SupplierBulkUpdateRequest(BaseModel):
    suppliers: list[SupplierBulkItem]


@router.post("/bulk-update")
async def bulk_update_suppliers(
    data: SupplierBulkUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Bulk update supplier master records by supplier_code."""
    updated_count = 0
    for item in data.suppliers:
        if not item.supplier_code:
            continue
        stmt = select(SupplierMaster).where(SupplierMaster.supplier_code == item.supplier_code.strip())
        sup = (await db.execute(stmt)).scalar_one_or_none()
        if sup:
            if item.supplier_name:
                sup.supplier_name = item.supplier_name.strip()
            if item.email is not None:
                cleaned_email = item.email.strip()
                if not cleaned_email or cleaned_email in ["-", "--", "none", "null", "N/A", "n/a"] or "@" not in cleaned_email:
                    sup.email = None
                else:
                    sup.email = cleaned_email
            if item.telephone is not None:
                sup.telephone = item.telephone.strip() or None
            if item.contact_person is not None:
                sup.contact_person = item.contact_person.strip() or None
            if item.allow_over_delivery is not None:
                sup.allow_over_delivery = item.allow_over_delivery
            updated_count += 1

    await db.commit()
    return {"message": f"อัปเดตข้อมูล Supplier สำเร็จ {updated_count} รายการ", "updated_count": updated_count}

