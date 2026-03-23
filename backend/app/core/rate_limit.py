"""Reusable rate limiter with in-memory and Redis backends.

Usage:
    limiter = get_rate_limiter()
    info = limiter.check("user:123", max_requests=20, window_seconds=60)
    if not info.allowed:
        # Return 429
"""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass


@dataclass
class RateLimitInfo:
    allowed: bool
    used: int
    limit: int
    reset_at: float  # Unix timestamp


class RateLimiter:
    """In-memory sliding-window rate limiter.

    Thread-safe. Suitable for single-worker deployments.
    """

    def __init__(self) -> None:
        self._buckets: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> RateLimitInfo:
        """Check if a request is allowed under the rate limit."""
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            timestamps = self._buckets.get(key, [])
            timestamps = [t for t in timestamps if t > window_start]
            used = len(timestamps)

            if used >= max_requests:
                self._buckets[key] = timestamps
                return RateLimitInfo(
                    allowed=False,
                    used=used,
                    limit=max_requests,
                    reset_at=timestamps[0] + window_seconds if timestamps else now + window_seconds,
                )

            timestamps.append(now)
            self._buckets[key] = timestamps
            return RateLimitInfo(
                allowed=True,
                used=used + 1,
                limit=max_requests,
                reset_at=now + window_seconds,
            )


class RedisRateLimiter:
    """Redis-backed rate limiter using atomic INCR + EXPIRE.

    Works across multiple workers. Requires `redis` package.
    """

    def __init__(self, redis_url: str) -> None:
        import redis
        self._redis = redis.from_url(redis_url)

    def check(self, key: str, max_requests: int, window_seconds: int) -> RateLimitInfo:
        """Check if a request is allowed under the rate limit."""
        now = time.time()
        redis_key = f"ratelimit:{key}:{int(now // window_seconds)}"

        pipe = self._redis.pipeline()
        pipe.incr(redis_key)
        pipe.expire(redis_key, window_seconds + 1)  # +1 for safety
        results = pipe.execute()
        current_count = results[0]

        reset_at = (int(now // window_seconds) + 1) * window_seconds

        if current_count > max_requests:
            return RateLimitInfo(
                allowed=False,
                used=current_count,
                limit=max_requests,
                reset_at=reset_at,
            )

        return RateLimitInfo(
            allowed=True,
            used=current_count,
            limit=max_requests,
            reset_at=reset_at,
        )


# Module-level singleton — uses Redis when REDIS_URL is set, in-memory otherwise
_limiter: RateLimiter | RedisRateLimiter | None = None
_lock = threading.Lock()


def get_rate_limiter() -> RateLimiter | RedisRateLimiter:
    """Get the global rate limiter instance."""
    global _limiter
    if _limiter is None:
        with _lock:
            if _limiter is None:
                redis_url = os.getenv("REDIS_URL")
                if redis_url:
                    _limiter = RedisRateLimiter(redis_url)
                else:
                    _limiter = RateLimiter()
    return _limiter
