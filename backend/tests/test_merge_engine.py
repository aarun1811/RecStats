from app.services.merge_engine import MergeEngine


def test_outer_join():
    left = {
        "columns": ["agent_code", "set_id", "total_items", "automatch_items"],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_items": 100, "automatch_items": 90},
            {"agent_code": "A1", "set_id": "S2", "total_items": 200, "automatch_items": 180},
        ],
        "row_count": 2,
    }
    right = {
        "columns": ["agent_code", "set_id", "total_manual_match_count"],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_manual_match_count": 5},
            {"agent_code": "A1", "set_id": "S3", "total_manual_match_count": 10},
        ],
        "row_count": 2,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["agent_code", "set_id"],
        merge_type="outer_join",
    )

    assert result["row_count"] == 3
    s1 = [r for r in result["rows"] if r.get("set_id") == "S1"][0]
    assert s1["total_items"] == 100
    assert s1["total_manual_match_count"] == 5
    s2 = [r for r in result["rows"] if r.get("set_id") == "S2"][0]
    assert s2["total_items"] == 200
    assert s2.get("total_manual_match_count") is None
    s3 = [r for r in result["rows"] if r.get("set_id") == "S3"][0]
    assert s3["total_manual_match_count"] == 10
    assert s3.get("total_items") is None


def test_inner_join():
    left = {
        "columns": ["k", "v1"],
        "rows": [{"k": "a", "v1": 1}, {"k": "b", "v1": 2}],
        "row_count": 2,
    }
    right = {
        "columns": ["k", "v2"],
        "rows": [{"k": "a", "v2": 10}],
        "row_count": 1,
    }
    result = MergeEngine.merge([left, right], merge_on=["k"], merge_type="inner_join")
    assert result["row_count"] == 1
    assert result["rows"][0]["k"] == "a"


def test_merge_empty_right():
    left = {
        "columns": ["k", "v"],
        "rows": [{"k": "a", "v": 1}],
        "row_count": 1,
    }
    right = {"columns": ["k", "v2"], "rows": [], "row_count": 0}
    result = MergeEngine.merge([left, right], merge_on=["k"], merge_type="outer_join")
    assert result["row_count"] == 1


def test_outer_join_coalesce_zero_fills_missing_numeric_cells():
    """coalesce_zero=True fills missing numeric cells in left-only / right-only
    rows with 0. Non-numeric (string/date) cells stay absent — '0' only applies
    to type=='number' columns based on cursor-detected types."""
    left = {
        "columns": [
            {"column_name": "agent_code", "name": "agent_code", "type": "string", "is_date": False},
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_items", "name": "total_items", "type": "number", "is_date": False},
            {"column_name": "automatch_items", "name": "automatch_items", "type": "number", "is_date": False},
        ],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_items": 100, "automatch_items": 90},
            {"agent_code": "A1", "set_id": "S2", "total_items": 200, "automatch_items": 180},
        ],
        "row_count": 2,
    }
    right = {
        "columns": [
            {"column_name": "agent_code", "name": "agent_code", "type": "string", "is_date": False},
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_manual_match_count", "name": "total_manual_match_count", "type": "number", "is_date": False},
        ],
        "rows": [
            {"agent_code": "A1", "set_id": "S1", "total_manual_match_count": 5},
            {"agent_code": "A1", "set_id": "S3", "total_manual_match_count": 10},
        ],
        "row_count": 2,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["agent_code", "set_id"],
        merge_type="outer_join",
        coalesce_zero=True,
    )

    assert result["row_count"] == 3
    rows_by_set = {r["set_id"]: r for r in result["rows"]}

    # Matched row — all numeric cells present
    assert rows_by_set["S1"]["total_items"] == 100
    assert rows_by_set["S1"]["total_manual_match_count"] == 5

    # Left-only row — right-side numeric cell coalesced to 0
    assert rows_by_set["S2"]["total_items"] == 200
    assert rows_by_set["S2"]["total_manual_match_count"] == 0

    # Right-only row — both left-side numeric cells coalesced to 0
    assert rows_by_set["S3"]["total_manual_match_count"] == 10
    assert rows_by_set["S3"]["total_items"] == 0
    assert rows_by_set["S3"]["automatch_items"] == 0


def test_outer_join_coalesce_zero_default_off_preserves_existing_behavior():
    """coalesce_zero defaults to False; behavior matches test_outer_join above."""
    left = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_items", "name": "total_items", "type": "number", "is_date": False},
        ],
        "rows": [{"set_id": "S1", "total_items": 100}],
        "row_count": 1,
    }
    right = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "manual_match", "name": "manual_match", "type": "number", "is_date": False},
        ],
        "rows": [{"set_id": "S2", "manual_match": 5}],
        "row_count": 1,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["set_id"],
        merge_type="outer_join",
    )

    rows_by_set = {r["set_id"]: r for r in result["rows"]}
    assert rows_by_set["S1"].get("manual_match") is None
    assert rows_by_set["S2"].get("total_items") is None


def test_outer_join_coalesce_zero_does_not_fill_non_numeric_cells():
    """String/date columns missing from one side stay absent even with
    coalesce_zero=True — filling them with 0 would corrupt downstream
    rendering ('0' showing in a 'Recon Name' column is wrong)."""
    left = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "total_items", "name": "total_items", "type": "number", "is_date": False},
        ],
        "rows": [{"set_id": "S1", "total_items": 100}],
        "row_count": 1,
    }
    right = {
        "columns": [
            {"column_name": "set_id", "name": "set_id", "type": "string", "is_date": False},
            {"column_name": "recon_name", "name": "recon_name", "type": "string", "is_date": False},
        ],
        "rows": [{"set_id": "S2", "recon_name": "TRADE_RECON_NA"}],
        "row_count": 1,
    }

    result = MergeEngine.merge(
        results=[left, right],
        merge_on=["set_id"],
        merge_type="outer_join",
        coalesce_zero=True,
    )

    rows_by_set = {r["set_id"]: r for r in result["rows"]}
    # numeric column coalesced
    assert rows_by_set["S2"]["total_items"] == 0
    # string column NOT coalesced — stays absent (would serialize as null)
    assert rows_by_set["S1"].get("recon_name") is None
