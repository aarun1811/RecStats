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
