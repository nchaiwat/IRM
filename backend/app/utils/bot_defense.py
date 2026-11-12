"""
In-App Bot Defense & Anti-Brute-Force Utility — Enterprise Central IAM Integration v2.10.0
3-Layer Defense Architecture:
  Layer 1: Sliding-Window IP Rate Limiter (10 req / 60s + Corporate Whitelist)
  Layer 2: Decoy Honeypot Trap (corporate_fax / security_honey)
  Layer 3: Submission Velocity & Timing Guard (< 400ms rejection)
Compliant with ISO 27001 (Control A.9.4.2 & A.12.4.1).
"""

import threading
import time
from typing import Dict, List, Tuple
from fastapi import Request

DEFAULT_RATE_LIMIT = 10  # Max requests per window
DEFAULT_WINDOW_SECONDS = 60  # Sliding window in seconds


class SlidingWindowRateLimiter:
    """In-Memory Sliding-Window Rate Limiter per Client IP."""

    def __init__(self, limit: int = DEFAULT_RATE_LIMIT, window: int = DEFAULT_WINDOW_SECONDS):
        self.limit = limit
        self.window = window
        self.records: Dict[str, List[float]] = {}
        self.lock = threading.Lock()
        # Predefined Corporate Whitelist (ISO 27001 / CIAM Spec Section 1.3 & F.2)
        self.whitelist = {
            "127.0.0.1",
            "::1",
            "localhost",
            "172.18.0.1",       # Docker bridge gateway host
            "157.173.219.153",   # Central IAM Production VPS
            "49.231.185.245",   # Window Asia HQ Gateway WAN (Egress IP)
            "58.8.190.63",      # Branch Office
        }

    def add_whitelist(self, ip: str) -> None:
        if ip and ip.strip():
            with self.lock:
                self.whitelist.add(ip.strip())

    def is_allowed(self, ip: str) -> Tuple[bool, int]:
        """
        Check if client IP is within allowed threshold.
        Returns:
            (is_allowed: bool, retry_after_seconds: int)
        """
        clean_ip = ip.strip() if ip else "unknown"
        if clean_ip in self.whitelist:
            return True, 0

        now = time.time()
        with self.lock:
            # Filter timestamps within current sliding window
            timestamps = [t for t in self.records.get(clean_ip, []) if t > (now - self.window)]
            if len(timestamps) >= self.limit:
                retry_after = max(1, int(timestamps[0] + self.window - now))
                self.records[clean_ip] = timestamps
                return False, retry_after

            timestamps.append(now)
            self.records[clean_ip] = timestamps
            return True, 0


# Global Singleton Rate Limiter
spoke_rate_limiter = SlidingWindowRateLimiter(limit=10, window=60)


def extract_client_ip(request: Request) -> str:
    """Extract real client IP prioritizing Cloudflare & Reverse Proxy headers."""
    for header in ("cf-connecting-ip", "x-forwarded-for", "x-real-ip"):
        val = request.headers.get(header)
        if val:
            ip = val.split(",")[0].strip()
            if ip:
                return ip
    return request.client.host if request.client else "127.0.0.1"
