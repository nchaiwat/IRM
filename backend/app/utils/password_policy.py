"""
Password Policy Utility — Enterprise Central IAM Integration v2.12.0
Strict Complexity Verification & 90-Day Forced Password Rotation Framework.
Compliant with ISO/IEC 27001 (A.9.4.3 Password Management System).
"""

from datetime import datetime, timezone
import re
from typing import Optional, Tuple

LOCAL_PASSWORD_EXPIRY_DAYS = 90


def validate_password_complexity(password: str, username: Optional[str] = None) -> Optional[str]:
    """
    Enterprise Password Complexity Standard:
    1. Length: 8 - 16 characters
    2. Uppercase (A-Z) >= 1
    3. Lowercase (a-z) >= 1
    4. Digit (0-9) >= 1
    5. Special Characters (!@#$%^&*...) >= 1
    6. No username inside password (case-insensitive for username length >= 3)

    Returns:
        None if valid, or a human-friendly error string in Thai if invalid.
    """
    if not password:
        return "กรุณาระบุรหัสผ่าน"

    pwd = password.strip()
    if len(pwd) < 8 or len(pwd) > 16:
        return f"รหัสผ่านต้องมีความยาวระหว่าง 8 ถึง 16 ตัวอักษร (ปัจจุบัน {len(pwd)} ตัวอักษร)"

    if not re.search(r"[A-Z]", pwd):
        return "รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่ (A-Z) อย่างน้อย 1 ตัว"

    if not re.search(r"[a-z]", pwd):
        return "รหัสผ่านต้องมีตัวอักษรพิมพ์เล็ก (a-z) อย่างน้อย 1 ตัว"

    if not re.search(r"[0-9]", pwd):
        return "รหัสผ่านต้องมีตัวเลข (0-9) อย่างน้อย 1 ตัว"

    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]", pwd):
        return "รหัสผ่านต้องมีอักขระพิเศษ (!@#$%^&*...) อย่างน้อย 1 ตัว"

    if username and len(username.strip()) >= 3 and username.strip().lower() in pwd.lower():
        return "รหัสผ่านต้องไม่มีชื่อผู้ใช้ (Username) ปะปนอยู่"

    return None


def is_password_expired(
    password_changed_at: Optional[datetime],
    created_at: Optional[datetime] = None,
) -> Tuple[bool, int]:
    """
    Calculate 90-day password expiration status.

    Returns:
        (is_expired: bool, days_left: int)
    """
    now = datetime.now(timezone.utc)
    base_dt = password_changed_at or created_at or now
    if base_dt.tzinfo is None:
        base_dt = base_dt.replace(tzinfo=timezone.utc)

    days_elapsed = (now - base_dt).days
    days_left = max(0, LOCAL_PASSWORD_EXPIRY_DAYS - days_elapsed)
    return (days_elapsed >= LOCAL_PASSWORD_EXPIRY_DAYS, days_left)
