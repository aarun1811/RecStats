"""Unit tests for query utility functions.

Covers: normalize_columns, detect_column_type, build_result_response,
validate_read_only, wrap_with_pagination.
"""

from __future__ import annotations

import pytest

from app.services.query_utils import (
    build_result_response,
    detect_column_type,
    normalize_columns,
    validate_read_only,
    wrap_with_pagination,
)


# ---------------------------------------------------------------------------
# normalize_columns
# ---------------------------------------------------------------------------

class TestNormalizeColumns:
    def test_oracle_uppercase(self):
        """Test 1: Oracle UPPERCASE column names normalized to lowercase."""
        result = normalize_columns(["STATUS", "RECON_ID", "Match_Rate"])
        assert result == ["status", "recon_id", "match_rate"]

    def test_already_lowercase(self):
        """Already lowercase names pass through unchanged."""
        result = normalize_columns(["id", "name", "value"])
        assert result == ["id", "name", "value"]

    def test_empty_list(self):
        """Empty list returns empty list."""
        assert normalize_columns([]) == []


# ---------------------------------------------------------------------------
# detect_column_type
# ---------------------------------------------------------------------------

class TestDetectColumnType:
    def test_varchar_to_string(self):
        """Test 5: VARCHAR/CHAR/TEXT/CLOB map to 'string'."""
        assert detect_column_type("VARCHAR") == ("string", False)
        assert detect_column_type("VARCHAR2") == ("string", False)
        assert detect_column_type("CHAR") == ("string", False)
        assert detect_column_type("TEXT") == ("string", False)
        assert detect_column_type("CLOB") == ("string", False)
        assert detect_column_type("NCHAR") == ("string", False)
        assert detect_column_type("NVARCHAR") == ("string", False)
        assert detect_column_type("NVARCHAR2") == ("string", False)
        assert detect_column_type("STRING") == ("string", False)

    def test_number_types(self):
        """Test 6: NUMBER/INTEGER/FLOAT/DECIMAL/NUMERIC map to 'number'."""
        assert detect_column_type("NUMBER") == ("number", False)
        assert detect_column_type("INTEGER") == ("number", False)
        assert detect_column_type("INT") == ("number", False)
        assert detect_column_type("FLOAT") == ("number", False)
        assert detect_column_type("DECIMAL") == ("number", False)
        assert detect_column_type("NUMERIC") == ("number", False)
        assert detect_column_type("DOUBLE") == ("number", False)
        assert detect_column_type("REAL") == ("number", False)
        assert detect_column_type("MONEY") == ("number", False)
        assert detect_column_type("NUMBER(10,2)") == ("number", False)

    def test_date_types(self):
        """Test 7: DATE/TIMESTAMP/TIME map to 'date'."""
        assert detect_column_type("DATE") == ("date", True)
        assert detect_column_type("TIMESTAMP") == ("date", True)
        assert detect_column_type("TIMESTAMP WITH TIME ZONE") == ("date", True)
        assert detect_column_type("TIME") == ("date", True)

    def test_unknown_defaults_to_string(self):
        """Test 8: Unknown types default to 'string'."""
        assert detect_column_type("BLOB") == ("string", False)
        assert detect_column_type("RAW") == ("string", False)
        assert detect_column_type("XMLTYPE") == ("string", False)

    def test_case_insensitive(self):
        """Type detection is case-insensitive."""
        assert detect_column_type("varchar") == ("string", False)
        assert detect_column_type("number") == ("number", False)
        assert detect_column_type("date") == ("date", True)
        assert detect_column_type("Timestamp") == ("date", True)


# ---------------------------------------------------------------------------
# build_result_response
# ---------------------------------------------------------------------------

class TestBuildResultResponse:
    def test_oracle_uppercase_columns_normalized(self):
        """Test 2: Oracle-style UPPERCASE columns return lowercase-keyed row dicts."""
        descriptions = [
            ("STATUS", "VARCHAR"),
            ("RECON_ID", "NUMBER"),
        ]
        rows = [
            ("matched", 101),
            ("unmatched", 102),
        ]
        result = build_result_response(descriptions, rows)
        assert result["rows"][0] == {"status": "matched", "recon_id": 101}
        assert result["rows"][1] == {"status": "unmatched", "recon_id": 102}

    def test_truncation(self):
        """Test 3: Rows exceeding max_rows are truncated."""
        descriptions = [("ID", "NUMBER")]
        rows = [(i,) for i in range(5)]
        result = build_result_response(descriptions, rows, max_rows=3)
        assert result["truncated"] is True
        assert result["row_count"] == 3
        assert len(result["rows"]) == 3

    def test_empty_rows(self):
        """Test 4: Zero rows returns correct empty shape."""
        descriptions = [("ID", "NUMBER"), ("NAME", "VARCHAR")]
        result = build_result_response(descriptions, [])
        assert result["rows"] == []
        assert result["row_count"] == 0
        assert result["truncated"] is False
        assert len(result["columns"]) == 2

    def test_columns_metadata_shape(self):
        """Test 9: Columns array has objects with {column_name, name, type, is_date}."""
        descriptions = [
            ("STATUS", "VARCHAR"),
            ("CREATED_AT", "TIMESTAMP"),
            ("AMOUNT", "NUMBER"),
        ]
        result = build_result_response(descriptions, [])

        col0 = result["columns"][0]
        assert col0["column_name"] == "status"
        assert col0["name"] == "status"
        assert col0["type"] == "string"
        assert col0["is_date"] is False

        col1 = result["columns"][1]
        assert col1["column_name"] == "created_at"
        assert col1["name"] == "created_at"
        assert col1["type"] == "date"
        assert col1["is_date"] is True

        col2 = result["columns"][2]
        assert col2["column_name"] == "amount"
        assert col2["name"] == "amount"
        assert col2["type"] == "number"
        assert col2["is_date"] is False

    def test_not_truncated_when_under_limit(self):
        """Rows at or under max_rows are not truncated."""
        descriptions = [("ID", "NUMBER")]
        rows = [(i,) for i in range(3)]
        result = build_result_response(descriptions, rows, max_rows=3)
        assert result["truncated"] is False
        assert result["row_count"] == 3

    def test_type_code_object_handling(self):
        """Type code as a class object (not string) is handled gracefully."""

        class FakeTypeCode:
            __name__ = "NUMBER"

        descriptions = [("AMOUNT", FakeTypeCode)]
        rows = [(42.5,)]
        result = build_result_response(descriptions, rows)
        assert result["columns"][0]["type"] == "number"


# ---------------------------------------------------------------------------
# validate_read_only
# ---------------------------------------------------------------------------

class TestValidateReadOnly:
    def test_select_allowed(self):
        """Test 10: SELECT statements are allowed."""
        assert validate_read_only("SELECT * FROM t") is True

    def test_with_cte_allowed(self):
        """Test 11: WITH (CTE) + SELECT is allowed."""
        assert validate_read_only("WITH cte AS (SELECT 1) SELECT * FROM cte") is True

    def test_insert_rejected(self):
        """Test 12: INSERT is rejected."""
        assert validate_read_only("INSERT INTO t VALUES (1)") is False

    def test_drop_rejected(self):
        """Test 13: DROP is rejected even with leading whitespace."""
        assert validate_read_only("  DROP TABLE t") is False

    def test_delete_case_insensitive(self):
        """Test 14: delete (lowercase) is rejected."""
        assert validate_read_only("delete FROM t") is False

    def test_update_rejected(self):
        """Test 15: UPDATE is rejected."""
        assert validate_read_only("UPDATE t SET x=1") is False

    def test_alter_rejected(self):
        """Test 16: ALTER is rejected."""
        assert validate_read_only("ALTER TABLE t ADD col INT") is False

    def test_create_rejected(self):
        """Test 17: CREATE is rejected."""
        assert validate_read_only("CREATE TABLE t (id INT)") is False

    def test_truncate_rejected(self):
        """Test 18: TRUNCATE is rejected."""
        assert validate_read_only("TRUNCATE TABLE t") is False

    def test_merge_rejected(self):
        """MERGE is rejected (from threat model T-13-01)."""
        assert validate_read_only("MERGE INTO t USING s ON ...") is False

    def test_grant_rejected(self):
        """GRANT is rejected (from threat model T-13-01)."""
        assert validate_read_only("GRANT SELECT ON t TO user1") is False

    def test_revoke_rejected(self):
        """REVOKE is rejected (from threat model T-13-01)."""
        assert validate_read_only("REVOKE SELECT ON t FROM user1") is False

    def test_select_with_leading_newlines(self):
        """SELECT with leading whitespace/newlines is allowed."""
        assert validate_read_only("\n  SELECT 1") is True

    def test_explain_allowed(self):
        """EXPLAIN SELECT is allowed (read-only analysis)."""
        assert validate_read_only("EXPLAIN SELECT * FROM t") is True


# ---------------------------------------------------------------------------
# wrap_with_pagination
# ---------------------------------------------------------------------------

class TestWrapWithPagination:
    def test_oracle_pagination(self):
        """Oracle uses OFFSET FETCH."""
        result = wrap_with_pagination(
            "SELECT * FROM t", limit=100, offset=50, dialect="oracle"
        )
        expected = (
            "SELECT * FROM (\nSELECT * FROM t\n) recviz_paged\n"
            "OFFSET 50 ROWS FETCH FIRST 100 ROWS ONLY"
        )
        assert result == expected

    def test_no_limit_returns_unchanged(self):
        """limit=None returns original SQL unchanged."""
        sql = "SELECT * FROM t"
        result = wrap_with_pagination(sql, limit=None, offset=0, dialect="oracle")
        assert result == sql

    def test_oracle_with_offset(self):
        """Oracle with non-zero offset uses subquery wrapper."""
        result = wrap_with_pagination(
            "SELECT id FROM users", limit=50, offset=100, dialect="oracle"
        )
        expected = (
            "SELECT * FROM (\nSELECT id FROM users\n) recviz_paged\n"
            "OFFSET 100 ROWS FETCH FIRST 50 ROWS ONLY"
        )
        assert result == expected

    def test_oracle_zero_offset(self):
        """Oracle with zero offset still wraps correctly."""
        result = wrap_with_pagination(
            "SELECT * FROM t", limit=10, offset=0, dialect="oracle"
        )
        expected = (
            "SELECT * FROM (\nSELECT * FROM t\n) recviz_paged\n"
            "OFFSET 0 ROWS FETCH FIRST 10 ROWS ONLY"
        )
        assert result == expected
