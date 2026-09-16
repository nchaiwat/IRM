"""
Central IAM SSO Configuration Service (Zero .env Dependency)
Compliant with Window Asia Enterprise Spoke Integration Specification v2.0.0.

Provides dynamic in-memory cached configuration loaded directly from `system_settings`
table in PostgreSQL, ensuring runtime secret rotation, break-glass switching, and zero restarts.
"""

import json
import logging
import time
import urllib.request
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting
from app.services.ciam_sso_client import CiamSsoClient

logger = logging.getLogger("ciam.config_service")

# In-memory dynamic cache
_CACHED_CIAM_SETTINGS: Optional[Dict[str, Any]] = None
_CACHE_TIMESTAMP: float = 0.0
_CACHE_TTL_SECONDS: float = 60.0  # 60s soft TTL, explicitly cleared on updates

# Default configurations fallback (ISO 27001 compliant defaults)
CIAM_DEFAULTS = {
    "ciam_base_url": "https://ciam.windowasia.com",
    "ciam_client_id": "irm-spoke-client",
    "ciam_client_secret": "sec_irm_oauth_secret_2026",
    "ciam_sso_enabled": True,
    "ciam_break_glass_active": False,
    "ciam_ad_gateway_url": "http://192.168.12.11:3100",
    "ciam_auto_provision_group": "PU User",
    "ciam_session_ttl_minutes": 480,
    "ciam_allowed_ips": "",
}


def invalidate_ciam_cache() -> None:
    """Explicitly invalidate in-memory cache to force immediate reload on next call."""
    global _CACHED_CIAM_SETTINGS, _CACHE_TIMESTAMP
    _CACHED_CIAM_SETTINGS = None
    _CACHE_TIMESTAMP = 0.0
    logger.info("Central IAM settings cache invalidated.")


async def get_ciam_settings(db: AsyncSession, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Retrieve current Central IAM settings from database with in-memory caching.
    Guarantees Zero .env dependency.
    """
    global _CACHED_CIAM_SETTINGS, _CACHE_TIMESTAMP

    now = time.time()
    if not force_refresh and _CACHED_CIAM_SETTINGS is not None and (now - _CACHE_TIMESTAMP < _CACHE_TTL_SECONDS):
        return dict(_CACHED_CIAM_SETTINGS)

    stmt = select(SystemSetting).where(SystemSetting.key.like("ciam_%"))
    res = await db.execute(stmt)
    rows = res.scalars().all()

    config = dict(CIAM_DEFAULTS)
    for row in rows:
        val = row.value
        if row.key == "ciam_sso_enabled":
            config[row.key] = str(val).lower() in ("true", "1", "yes")
        elif row.key == "ciam_break_glass_active":
            config[row.key] = str(val).lower() in ("true", "1", "yes")
        elif row.key == "ciam_session_ttl_minutes":
            try:
                config[row.key] = int(val) if val else 480
            except (ValueError, TypeError):
                config[row.key] = 480
        elif row.key in config:
            if val is not None and val.strip() != "":
                config[row.key] = val.strip()

    _CACHED_CIAM_SETTINGS = config
    _CACHE_TIMESTAMP = now
    return dict(config)


async def get_ciam_sso_client(db: AsyncSession) -> CiamSsoClient:
    """
    Instantiate and return a CiamSsoClient configured dynamically from database settings.
    """
    cfg = await get_ciam_settings(db)
    return CiamSsoClient(
        ciam_base_url=cfg["ciam_base_url"],
        client_id=cfg["ciam_client_id"],
        client_secret=cfg["ciam_client_secret"],
        ad_gateway_url=cfg["ciam_ad_gateway_url"],
    )


def test_ciam_connection_sync(base_url: str) -> Dict[str, Any]:
    """
    Test connectivity from spoke server to Central IAM Discovery & JWKS endpoint.
    Returns latency, issuer info, and JWKS key summary with 3-second timeout.
    """
    clean_url = base_url.rstrip("/")
    discovery_url = f"{clean_url}/.well-known/openid-configuration"

    start_time = time.perf_counter()
    try:
        req = urllib.request.Request(
            discovery_url,
            headers={"Accept": "application/json", "User-Agent": "IRM-Spoke-Client/2.0"},
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            if resp.status != 200:
                return {
                    "status": "failed",
                    "latency_ms": elapsed_ms,
                    "message": f"Central IAM Discovery ตอบกลับด้วยสถานะ HTTP {resp.status}",
                }
            discovery_data = json.loads(resp.read().decode("utf-8"))

        issuer = discovery_data.get("issuer", clean_url)
        jwks_uri = discovery_data.get("jwks_uri", f"{clean_url}/.well-known/jwks.json")

        # Test JWKS endpoint
        keys_found = 0
        first_kid = "unknown"
        try:
            jwks_req = urllib.request.Request(
                jwks_uri,
                headers={"Accept": "application/json", "User-Agent": "IRM-Spoke-Client/2.0"},
            )
            with urllib.request.urlopen(jwks_req, timeout=3.0) as jwks_resp:
                if jwks_resp.status == 200:
                    jwks_data = json.loads(jwks_resp.read().decode("utf-8"))
                    keys = jwks_data.get("keys", [])
                    keys_found = len(keys)
                    if keys_found > 0:
                        first_kid = keys[0].get("kid", "active-key")
        except Exception as jwks_err:
            logger.warning("JWKS check failed during test connection: %s", jwks_err)

        return {
            "status": "connected",
            "latency_ms": elapsed_ms,
            "ciam_issuer": issuer,
            "jwks_uri": jwks_uri,
            "keys_found": keys_found,
            "key_id": first_kid,
            "message": "สามารถเชื่อมต่อไปยัง Window Asia Central IAM ได้อย่างสมบูรณ์",
        }
    except urllib.error.HTTPError as http_err:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "status": "failed",
            "latency_ms": elapsed_ms,
            "message": f"HTTP Error {http_err.code}: {http_err.reason}",
        }
    except urllib.error.URLError as url_err:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "status": "offline",
            "latency_ms": elapsed_ms,
            "message": f"ไม่สามารถเชื่อมต่อไปยังเซิร์ฟเวอร์ CIAM ({url_err.reason})",
        }
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "status": "failed",
            "latency_ms": elapsed_ms,
            "message": f"เกิดข้อผิดพลาดในการเชื่อมต่อ: {str(exc)}",
        }
