from typing import Any, Optional
import json
import time
from app.core.config import settings


class CacheBackend:
    async def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError

    async def set(self, key: str, value: Any, expire_seconds: int = 60) -> None:
        raise NotImplementedError


class MemoryCache(CacheBackend):
    def __init__(self):
        self._store = {}

    async def get(self, key: str) -> Optional[Any]:
        record = self._store.get(key)
        if not record:
            return None
        if time.time() > record["expires_at"]:
            del self._store[key]
            return None
        return record["value"]

    async def set(self, key: str, value: Any, expire_seconds: int = 60) -> None:
        self._store[key] = {"value": value, "expires_at": time.time() + expire_seconds}


class RedisCache(CacheBackend):
    def __init__(self, redis_url: str):
        import redis.asyncio as redis

        self.redis = redis.from_url(redis_url)

    async def get(self, key: str) -> Optional[Any]:
        val = await self.redis.get(key)
        if val:
            return json.loads(val)
        return None

    async def set(self, key: str, value: Any, expire_seconds: int = 60) -> None:
        await self.redis.set(key, json.dumps(value), ex=expire_seconds)


if settings.REDIS_URL:
    cache = RedisCache(settings.REDIS_URL)
else:
    cache = MemoryCache()
