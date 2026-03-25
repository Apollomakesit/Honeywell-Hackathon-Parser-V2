"""Database connection pool management."""

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg

_pool: asyncpg.Pool | None = None


def normalize_database_url(database_url: str) -> str:
    """Remove query parameters Prisma accepts but asyncpg does not."""
    if not database_url:
        return database_url

    parts = urlsplit(database_url)
    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
        if key != "schema"
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(filtered_query), parts.fragment))


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        database_url = os.environ.get("DATABASE_URL", "")
        database_url = normalize_database_url(database_url)
        _pool = await asyncpg.create_pool(database_url, min_size=2, max_size=10)
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
