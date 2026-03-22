"""Redis-backed cache service."""

from __future__ import annotations

import redis.asyncio as redis


class CacheService:
    """Async Redis cache for query results and computed data."""

    def __init__(self, redis_url: str):
        self.redis: redis.Redis = redis.from_url(redis_url, decode_responses=True)

    async def get(self, key: str) -> str | None:
        """Get a cached value by key."""
        return await self.redis.get(key)

    async def set(self, key: str, value: str, ttl: int = 300) -> None:
        """Set a cached value with TTL in seconds (default 5 min)."""
        await self.redis.set(key, value, ex=ttl)

    async def delete(self, key: str) -> None:
        """Delete a single cached key."""
        await self.redis.delete(key)

    async def clear_pattern(self, pattern: str) -> None:
        """Delete all keys matching a pattern (e.g. 'chart-data:*').

        Uses SCAN to avoid blocking Redis on large keyspaces.
        """
        cursor: int | bytes = 0
        while True:
            cursor, keys = await self.redis.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await self.redis.delete(*keys)
            if cursor == 0:
                break

    async def close(self) -> None:
        """Close the Redis connection."""
        await self.redis.close()
