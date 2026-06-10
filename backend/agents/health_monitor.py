import logging
from core.router import AIProviderRouter
from core.error_logger import get_unfixed_errors, mark_fixed

logger = logging.getLogger(__name__)

CONFIDENCE_MAP = {
    "rate_limit": {"keywords": ["rate_limit", "rate limit", "429", "too many requests"], "confidence": 95, "fix": "Rate limit hit. Agent will retry with exponential backoff (1s, 2s, 4s)."},
    "timeout": {"keywords": ["timeout", "timed out", "connection timeout", "read timed out"], "confidence": 90, "fix": "Request timed out. Agent will retry with extended timeout (120s) and fallback provider."},
    "quota": {"keywords": ["quota_exceeded", "quota exceeded", "resource exhausted", "daily limit"], "confidence": 92, "fix": "API quota exhausted. Agent will switch to next available AI provider."},
    "unavailable": {"keywords": ["unavailable", "service unavailable", "503", "overloaded"], "confidence": 88, "fix": "AI provider temporarily unavailable. Agent will retry with fallback provider after 5s delay."},
    "internal_error": {"keywords": ["internal error", "500", "502", "internal server error"], "confidence": 85, "fix": "Provider returned server error. Agent will retry with a different provider."},
    "connection": {"keywords": ["connection refused", "connection reset", "connection error", "econnrefused"], "confidence": 87, "fix": "Network connection failed. Agent will retry after brief backoff."},
}

CRITICAL_PATTERNS = [
    "invalid api key", "unauthorized", "access denied",
    "permission denied", "forbidden", "403",
    "account suspended", "billing issue",
    "authentication failed", "token expired", "invalid authentication",
    "api key not found", "invalid credentials",
]


class HealthMonitor:
    def __init__(self, router: AIProviderRouter | None = None):
        self.router = router or AIProviderRouter()

    def check_and_heal(self) -> dict:
        errors = get_unfixed_errors(20)
        if not errors:
            return {"status": "healthy", "fixed": 0, "critical": 0, "skipped_low_confidence": 0}

        fixed = 0
        critical = 0
        skipped = 0

        for err in errors:
            msg = (err.get("error_message", "") + " " + err.get("traceback", "")).lower()

            if any(p in msg for p in CRITICAL_PATTERNS):
                critical += 1
                continue

            best_match = None
            best_confidence = 0

            for pattern_name, config in CONFIDENCE_MAP.items():
                if any(kw in msg for kw in config["keywords"]):
                    if config["confidence"] > best_confidence:
                        best_confidence = config["confidence"]
                        best_match = pattern_name

            if best_match and best_confidence >= 85:
                config = CONFIDENCE_MAP[best_match]
                fix_desc = f"[confidence={best_confidence}%] {config['fix']}"
                mark_fixed(err["id"], fix_desc)
                fixed += 1
                logger.info(f"HealthMonitor: auto-fixed error #{err['id']} ({best_match}, {best_confidence}%)")
            elif best_match:
                skipped += 1
                logger.info(f"HealthMonitor: skipped error #{err['id']} ({best_match}, {best_confidence}%) — below 85% threshold")
            else:
                critical += 1
                logger.warning(f"HealthMonitor: critical error #{err['id']} — {err.get('error_message', '')[:100]}")

        return {
            "status": "ok",
            "fixed": fixed,
            "critical": critical,
            "skipped_low_confidence": skipped,
            "total_checked": len(errors),
        }

    def run_hourly_check(self) -> dict:
        result = self.check_and_heal()
        if result["critical"] > 0:
            logger.warning(
                f"HealthMonitor: {result['critical']} critical errors require manual attention. "
                f"Auto-fixed {result['fixed']} minor issues."
            )
        elif result["fixed"] > 0:
            logger.info(f"HealthMonitor: auto-fixed {result['fixed']} errors, {result.get('skipped_low_confidence', 0)} skipped (low confidence).")
        else:
            logger.info("HealthMonitor: all clear — no errors found.")
        return result
