"""Tests for schema introspection endpoints (Unit 3a)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


def test_table_name_regex_rejects_injection():
    """The table_name validator should reject SQL injection attempts."""
    from app.api.databases import TABLE_NAME_RE

    assert TABLE_NAME_RE.match("ITEMS") is not None
    assert TABLE_NAME_RE.match("message_feed") is not None
    assert TABLE_NAME_RE.match("TBL$1") is not None    # Oracle allows $
    assert TABLE_NAME_RE.match("T_123") is not None

    # Bad ones
    assert TABLE_NAME_RE.match("1_LEADING_DIGIT") is None
    assert TABLE_NAME_RE.match("DROP TABLE") is None
    assert TABLE_NAME_RE.match("ITEMS; SELECT 1") is None
    assert TABLE_NAME_RE.match("ITEMS'--") is None
    assert TABLE_NAME_RE.match("") is None
    assert TABLE_NAME_RE.match("A" * 31) is None       # too long (max 30)


def test_nullable_normalization():
    """nullable values from Oracle and Postgres should normalize to bool."""
    from app.api.databases import _normalize_nullable

    # Oracle returns 'Y' / 'N' — test both so a broken predicate like
    # `raw in ("Y", "YES", "N")` would be caught
    assert _normalize_nullable("Y") is True
    assert _normalize_nullable("N") is False

    # Postgres information_schema returns 'YES' / 'NO'
    assert _normalize_nullable("YES") is True
    assert _normalize_nullable("NO") is False

    # Case-insensitive
    assert _normalize_nullable("y") is True
    assert _normalize_nullable("n") is False

    # Unknown values default to True (permissive)
    assert _normalize_nullable(None) is True
    assert _normalize_nullable("") is True
    assert _normalize_nullable("maybe") is True
