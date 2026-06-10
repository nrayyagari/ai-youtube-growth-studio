import logging
from core.router import AIProviderRouter
from core.error_logger import get_unfixed_errors, mark_fixed

logger = logging.getLogger(__name__)

MINOR_PATTERNS = [
    "rate_limit", "rate limit", "429", "too many requests",
    "timeout", "timed out", "Connection timeout",
    "temporarily unavailable", "service unavailable",
    "quota_exceeded", "quota exceeded",
    "internal error", "500", "502", "503",
]

CRITICAL_PATTERNS = [
    "invalid api key", "unauthorized", "access denied",
    "permission denied", "forbidden", "403",
    "account suspended", "billing issue",
    "authentication failed", "token expired",
]


class HealthMonitor:
    def __init__(self, router: AIProviderRouter | None = None):
        self.router = router or AIProviderRouter()

    def check_and_heal(self) -> dict:
        errors = get_unfixed_errors(20)
        if not errors:
            return {"status": "healthy", "fixed": 0, "critical": 0}

        fixed = 0
        critical = 0

        for err in errors:
            msg = (err.get("error_message", "") + " " + err.get("traceback", "")).lower()

            is_critical = any(p in msg for p in CRITICAL_PATTERNS)
            is_minor = any(p in msg for p in MINOR_PATTERNS)

            if is_critical:
                critical += 1
                continue

            if is_minor:
                fix = self._auto_heal(err)
                if fix:
                    mark_fixed(err["id"], fix)
                    fixed += 1
                else:
                    critical += 1
            else:
                critical += 1

        return {"status": "ok", "fixed": fixed, "critical": critical, "total_checked": len(errors)}

    def _auto_heal(self, err: dict) -> str | None:
        msg = (err.get("error_message", "") + " " + err.get("traceback", "")).lower()

        if "rate_limit" in msg or "429" in msg or "too many requests" in msg:
            return "Rate limit detected. Agent will retry with backoff."

        if "timeout" in msg or "timed out" in msg:
            return "Timeout detected. Agent will retry with longer timeout."

        if "quota" in msg:
            return "Quota exceeded. Switching to next AI provider."

        if "unavailable" in msg or "500" in msg:
            return "Service unavailable. Agent will retry with fallback provider."

        if "connection" in msg:
            return "Connection error. Agent will retry."

        return None

    def run_hourly_check(self) -> dict:
        result = self.check_and_heal()
        if result["critical"] > 0:
            logger.warning(
                f"HealthMonitor: {result['critical']} critical errors found, "
                f"{result['fixed']} fixed automatically."
            )
        elif result["fixed"] > 0:
            logger.info(f"HealthMonitor: auto-fixed {result['fixed']} minor errors.")
        else:
            logger.info("HealthMonitor: all clear.")
        return result
