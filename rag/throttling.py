import logging

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

logger = logging.getLogger(__name__)


class SafeAnonRateThrottle(AnonRateThrottle):
    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception as e:
            logger.warning(f"Throttle check failed (Redis unavailable?): {e}")
            return True  # Fail open — allow request rather than 500


class SafeUserRateThrottle(UserRateThrottle):
    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception as e:
            logger.warning(f"Throttle check failed (Redis unavailable?): {e}")
            return True  # Fail open — allow request rather than 500
