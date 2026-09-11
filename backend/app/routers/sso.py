"""
Spoke Application Single Sign-On (SSO) Router
Standardized OIDC / PKCE Single Sign-On Endpoint Handlers with Break-Glass Fallback.
Compliant with Window Asia Enterprise Spoke Integration Specification v2.0.0 (Zero .env Edition).
"""

from datetime import datetime, timezone
import logging
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.group import Group
from app.models.system_setting import SystemSetting
from app.services.ciam_sso_client import CiamSsoClient
from app.services.ciam_config_service import (
    get_ciam_settings,
    get_ciam_sso_client,
    invalidate_ciam_cache,
)
from app.services.log_service import record_transaction_log
from app.utils.security import create_access_token, create_refresh_token, hash_password

logger = logging.getLogger("spoke.sso")
router = APIRouter(prefix="/api/auth/sso", tags=["Single Sign-On (CIAM SSO)"])


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────

class SsoConfigResponse(BaseModel):
    sso_enabled: bool
    break_glass_active: bool = False
    ciam_base_url: str
    client_id: str
    ad_gateway_url: str
    login_button_label: str = "เข้าสู่ระบบด้วย Central IAM (SSO)"
    fallback_available: bool = True
    fallback_ad_available: bool = True


class SsoAuthorizeUrlRequest(BaseModel):
    redirect_uri: str
    state: Optional[str] = None


class SsoAuthorizeUrlResponse(BaseModel):
    authorize_url: str
    code_verifier: str
    state: str


class SsoCallbackRequest(BaseModel):
    code: str
    redirect_uri: str
    code_verifier: str
    state: Optional[str] = None


class SsoTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class SsoBreakGlassToggleRequest(BaseModel):
    break_glass_active: bool
    reason: Optional[str] = "Manual break-glass toggle by administrator"


# ──────────────────────────────────────────────────────────────────────────────
# Group B: SSO Execution Channel Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/config", response_model=SsoConfigResponse)
async def get_sso_config(db: Annotated[AsyncSession, Depends(get_db)]):
    """
    Returns SSO runtime configuration, CIAM portal URL, and Break-Glass status.
    Directly reflects dynamic settings from database without .env dependency.
    """
    cfg = await get_ciam_settings(db)
    sso_active = cfg["ciam_sso_enabled"] and not cfg["ciam_break_glass_active"]

    return SsoConfigResponse(
        sso_enabled=sso_active,
        break_glass_active=cfg["ciam_break_glass_active"],
        ciam_base_url=cfg["ciam_base_url"],
        client_id=cfg["ciam_client_id"],
        ad_gateway_url=cfg["ciam_ad_gateway_url"],
        login_button_label="เข้าสู่ระบบด้วย Central IAM (SSO)",
        fallback_available=True,
        fallback_ad_available=True,
    )


@router.post("/authorize-url", response_model=SsoAuthorizeUrlResponse)
async def generate_authorize_url(
    req: SsoAuthorizeUrlRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Generates cryptographically random PKCE code_verifier and code_challenge (S256),
    and constructs the Central IAM authorization redirect URL.
    """
    cfg = await get_ciam_settings(db)
    if not cfg["ciam_sso_enabled"] or cfg["ciam_break_glass_active"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Central IAM SSO is currently disabled (Break-Glass Mode Active). Please use local credentials.",
        )

    sso_client = await get_ciam_sso_client(db)
    code_verifier, code_challenge = sso_client.generate_pkce()
    state = req.state or f"state_{int(datetime.now(timezone.utc).timestamp())}"

    authorize_url = sso_client.get_authorize_url(
        redirect_uri=req.redirect_uri,
        state=state,
        code_challenge=code_challenge,
        code_challenge_method="S256",
        scope="openid profile email",
    )

    return SsoAuthorizeUrlResponse(
        authorize_url=authorize_url,
        code_verifier=code_verifier,
        state=state,
    )


@router.post("/callback", response_model=SsoTokenResponse)
async def handle_sso_callback(
    req: SsoCallbackRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Exchanges One-Time Authorization Code for RS256 ID Token via Backend-to-Backend channel.
    Cryptographically verifies signature via Central IAM JWKS, matches or auto-provisions user,
    and returns an application access token.
    """
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    cfg = await get_ciam_settings(db)
    sso_client = await get_ciam_sso_client(db)

    # Step 1: Exchange code for tokens
    try:
        tokens = sso_client.exchange_code_for_tokens(
            code=req.code,
            redirect_uri=req.redirect_uri,
            code_verifier=req.code_verifier,
        )
    except Exception as exc:
        logger.error("SSO Code exchange failed: %s", exc)
        await record_transaction_log(
            category="ciam_sso",
            action="login_failed",
            status="failed",
            message=f"การยืนยันตัวตน SSO ล้มเหลว: ไม่สามารถแลกเปลี่ยนโค้ดได้ ({str(exc)})",
            details={"error": "CodeExchangeFailed", "ip": client_ip, "detail": str(exc)},
            triggered_by=f"ip:{client_ip}",
            db=db,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to exchange SSO code: {str(exc)}",
        )

    id_token = tokens.get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Central IAM did not return an ID Token",
        )

    # Step 2: Cryptographically verify ID Token signature using JWKS
    try:
        claims = sso_client.verify_id_token(id_token)
    except Exception as exc:
        logger.error("SSO ID Token verification failed: %s", exc)
        await record_transaction_log(
            category="ciam_sso",
            action="login_failed",
            status="failed",
            message=f"การยืนยันตัวตน SSO ล้มเหลว: การตรวจสอบลายมือชื่อผิดพลาด ({str(exc)})",
            details={"error": "SignatureVerificationFailed", "ip": client_ip, "detail": str(exc)},
            triggered_by=f"ip:{client_ip}",
            db=db,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Cryptographic signature verification failed: {str(exc)}",
        )

    username = claims.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing subject (sub) claim",
        )

    # Step 3: Match user in database
    stmt = select(User).where(User.username == username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Match by email
        email = claims.get("email")
        if email:
            stmt_email = select(User).where(User.email == email)
            res_email = await db.execute(stmt_email)
            user = res_email.scalar_one_or_none()

    if not user:
        # Step 4: Auto-provision user in spoke application
        target_group_name = cfg.get("ciam_auto_provision_group", "PU User")
        grp_stmt = select(Group).where(Group.name == target_group_name)
        grp_res = await db.execute(grp_stmt)
        assigned_grp = grp_res.scalar_one_or_none()

        if not assigned_grp:
            # Fallback to PU User
            pu_stmt = select(Group).where(Group.name == "PU User")
            assigned_grp = (await db.execute(pu_stmt)).scalar_one_or_none()

        logger.info("Auto-provisioning user from Central IAM: %s to group %s", username, assigned_grp.name if assigned_grp else "None")
        user = User(
            username=username,
            password_hash=hash_password("SSO_MANAGED_ACCOUNT"),
            full_name=claims.get("name") or username,
            email=claims.get("email") or f"{username.lower()}@windowasia.com",
            department=claims.get("department") or "Purchasing",
            group_id=assigned_grp.id if assigned_grp else None,
            use_ad_auth=True,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        # Record ISO 27001 Log (SSO-03)
        await record_transaction_log(
            category="ciam_sso",
            action="auto_provision_user",
            status="info",
            message=f"สร้างบัญชีผู้ใช้ใหม่อัตโนมัติจาก Central IAM: '{username}'",
            details={
                "username": username,
                "email": user.email,
                "group_assigned": assigned_grp.name if assigned_grp else "None",
                "claims": claims,
            },
            triggered_by="system:ciam",
            db=db,
        )

    # Step 5: Verify account active state
    if not user.is_active:
        logger.warning("SSO Login rejected: user '%s' is deactivated", username)
        # Record ISO 27001 Log (SSO-04)
        await record_transaction_log(
            category="ciam_sso",
            action="account_deactivated",
            status="warning",
            message=f"ปฏิเสธการเข้าสู่ระบบ: บัญชีพนักงาน '{username}' ถูกระงับสิทธิ์ในระบบนี้",
            details={"username": username, "ip": client_ip, "reason": "is_active is false"},
            triggered_by=f"user:{username}",
            db=db,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated in this system by IT Governance.",
        )

    # Update last login timestamp
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    # Step 6: Generate Spoke Application JWT Access & Refresh Tokens
    token_data = {"sub": user.username, "user_id": user.id}
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    # Record ISO 27001 Audit Log (SSO-01)
    await record_transaction_log(
        category="ciam_sso",
        action="login_success",
        status="success",
        message=f"เข้าสู่ระบบผ่าน Central IAM SSO สำเร็จ: ผู้ใช้ '{user.username}'",
        details={
            "username": user.username,
            "ip": client_ip,
            "ciam_issuer": claims.get("iss"),
            "auth_method": "OIDC_PKCE_S256",
            "roles": claims.get("roles", {}),
        },
        triggered_by=f"user:{user.username}",
        db=db,
    )

    return SsoTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user={
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "department": user.department,
            "group_id": user.group_id,
        },
    )


@router.post("/break-glass-toggle")
async def toggle_break_glass_mode(
    req: SsoBreakGlassToggleRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Emergency Break-Glass Control:
    Allows administrators to immediately toggle Central IAM SSO enforcement ON or OFF
    persisting into database system_settings table, triggering immediate cache invalidation.
    """
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    # Update ciam_break_glass_active and ciam_sso_enabled in system_settings
    stmt_bg = select(SystemSetting).where(SystemSetting.key == "ciam_break_glass_active")
    row_bg = (await db.execute(stmt_bg)).scalar_one_or_none()
    if row_bg:
        row_bg.value = "true" if req.break_glass_active else "false"
    else:
        db.add(SystemSetting(
            key="ciam_break_glass_active",
            value="true" if req.break_glass_active else "false",
            category="central_iam",
            data_type="boolean",
            description="โหมดปลดระบบฉุกเฉิน",
        ))

    stmt_sso = select(SystemSetting).where(SystemSetting.key == "ciam_sso_enabled")
    row_sso = (await db.execute(stmt_sso)).scalar_one_or_none()
    if row_sso:
        row_sso.value = "false" if req.break_glass_active else "true"
    else:
        db.add(SystemSetting(
            key="ciam_sso_enabled",
            value="false" if req.break_glass_active else "true",
            category="central_iam",
            data_type="boolean",
            description="สวิตช์เปิด/ปิด SSO",
        ))

    await db.commit()
    invalidate_ciam_cache()

    state_desc = "ENABLED (Break-Glass Fallback Active)" if req.break_glass_active else "DISABLED (Normal SSO Active)"
    logger.critical("🚨 BREAK-GLASS TOGGLE TRIGGERED: Break-Glass is now %s. Reason: %s", state_desc, req.reason)

    # Record ISO 27001 Log (BG-01)
    await record_transaction_log(
        category="security_break_glass",
        action="toggle_break_glass",
        status="warning" if req.break_glass_active else "success",
        message=f"สลับสถานะระบบ Break-Glass: {state_desc}",
        details={"break_glass_active": req.break_glass_active, "reason": req.reason, "ip": client_ip},
        triggered_by="system:emergency_admin",
        db=db,
    )

    return {
        "status": "SUCCESS",
        "break_glass_active": req.break_glass_active,
        "sso_enabled": not req.break_glass_active,
        "mode": "BREAK_GLASS_AD_GATEWAY_FALLBACK" if req.break_glass_active else "CENTRAL_IAM_SSO",
        "message": f"Break-Glass status successfully switched to: {state_desc}",
    }
