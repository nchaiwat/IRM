"""
Active Directory (AD Sync Agent Gateway) Integration Service.
Provides authentication verification against internal Active Directory via Identity Gateway.
"""

import logging
from datetime import datetime, timezone
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)


async def get_ad_settings(db: AsyncSession) -> dict[str, any]:
    """Retrieve all AD Gateway configuration values from SystemSetting table."""
    stmt = select(SystemSetting).where(SystemSetting.key.like("ad_%"))
    result = await db.execute(stmt)
    settings = result.scalars().all()
    config = {s.key: s.value or "" for s in settings}

    return {
        "ad_gateway_url": config.get("ad_gateway_url", "").strip(),
        "ad_app_id": config.get("ad_app_id", "").strip(),
        "ad_secret_key": config.get("ad_secret_key", "").strip(),
        "ad_forwarded_ip": config.get("ad_forwarded_ip", "157.173.219.153").strip(),
        "ad_enabled": config.get("ad_enabled", "false").strip().lower() in ("true", "1", "yes"),
    }


async def verify_ad_credentials(
    db: AsyncSession,
    username: str,
    password: str,
    override_config: dict[str, str] | None = None,
) -> tuple[bool, str, dict | None]:
    """
    Verify user credentials against AD Gateway.
    Returns: (is_success: bool, message: str, response_data: dict | None)
    """
    config = await get_ad_settings(db)
    if override_config:
        config.update(override_config)

    gateway_url = config.get("ad_gateway_url")
    app_id = config.get("ad_app_id")
    secret_key = config.get("ad_secret_key")
    forwarded_ip = config.get("ad_forwarded_ip") or "157.173.219.153"

    if not gateway_url:
        return False, "ไม่ได้กำหนดค่า AD Gateway URL ในระบบ", None
    if not app_id:
        return False, "ไม่ได้กำหนดค่า App ID ในระบบ", None
    if not secret_key:
        return False, "ไม่ได้กำหนดค่า Secret Key ในระบบ", None

    # Current UTC timestamp in ISO 8601 format (must be within 5 minutes of gateway server clock)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    payload = {
        "app_id": app_id,
        "secret_key": secret_key,
        "username": username.strip(),
        "password": password,
        "timestamp": timestamp,
    }

    headers = {
        "Content-Type": "application/json",
        "X-Forwarded-For": forwarded_ip,
    }

    # Mask password for secure debug logging
    masked_pw = (password[:1] + "x" * (len(password) - 2) + password[-1:]) if len(password) > 2 else "xxx"
    logger.info(
        f"[AD-AUTH] Requesting AD Gateway: {gateway_url} | app_id={app_id} | username={username} | password={masked_pw} | timestamp={timestamp} | ip={forwarded_ip}"
    )

    try:
        # Note: verify=False allows self-signed certs over reverse tunnel / intranet HTTPS
        async with httpx.AsyncClient(timeout=10.0, verify=False) as client:
            resp = await client.post(gateway_url, json=payload, headers=headers)

            try:
                resp_json = resp.json()
            except Exception:
                resp_json = {"raw": resp.text}

            logger.info(f"[AD-AUTH] Gateway Response HTTP {resp.status_code}: {resp_json}")

            if resp.status_code in (200, 201):
                # Standard success from AD Gateway
                msg = resp_json.get("message") or "เข้าสู่ระบบผ่าน Active Directory สำเร็จ"
                return True, msg, resp_json
            else:
                err_msg = (
                    resp_json.get("detail")
                    or resp_json.get("message")
                    or resp_json.get("error")
                    or f"AD Gateway ปฏิเสธการเข้าถึง (HTTP {resp.status_code})"
                )
                return False, str(err_msg), resp_json

    except httpx.ConnectTimeout:
        logger.error(f"[AD-AUTH] Connection timed out while connecting to {gateway_url}")
        return False, "การเชื่อมต่อไปยัง AD Gateway หมดเวลา (Connection Timeout)", None
    except httpx.ConnectError as e:
        logger.error(f"[AD-AUTH] Connection error: {e}")
        return False, f"ไม่สามารถเชื่อมต่อ AD Gateway ได้: {str(e)}", None
    except Exception as e:
        logger.error(f"[AD-AUTH] Unexpected error: {e}")
        return False, f"เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์กับ AD: {str(e)}", None
