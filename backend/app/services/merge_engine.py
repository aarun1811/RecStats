from __future__ import annotations


class MergeEngine:
    @staticmethod
    def merge(
        results: list[dict],
        merge_on: list[str],
        merge_type: str = "outer_join",
    ) -> dict:
        if merge_type not in ("outer_join", "inner_join"):
            raise ValueError(f"Unsupported merge_type: {merge_type}")
        if not results:
            return {"columns": [], "rows": [], "row_count": 0}
        if len(results) == 1:
            return {**results[0], "rows": list(results[0]["rows"])}

        merged = results[0]
        for i in range(1, len(results)):
            merged = MergeEngine._merge_two(merged, results[i], merge_on, merge_type)
        return merged

    @staticmethod
    def _merge_two(
        left: dict,
        right: dict,
        merge_on: list[str],
        merge_type: str,
    ) -> dict:
        def make_key(row: dict) -> tuple:
            return tuple(row.get(k) for k in merge_on)

        right_index: dict[tuple, dict] = {}
        for row in right["rows"]:
            key = make_key(row)
            right_index[key] = row

        all_columns = list(left["columns"])
        for col in right["columns"]:
            if col not in all_columns:
                all_columns.append(col)

        merged_rows = []
        seen_keys = set()

        for lrow in left["rows"]:
            key = make_key(lrow)
            seen_keys.add(key)
            rrow = right_index.get(key)

            if rrow:
                merged = {**lrow, **rrow}
                merged_rows.append(merged)
            elif merge_type == "outer_join":
                merged_rows.append({**lrow})

        if merge_type == "outer_join":
            for rrow in right["rows"]:
                key = make_key(rrow)
                if key not in seen_keys:
                    merged_rows.append({**rrow})

        return {
            "columns": all_columns,
            "rows": merged_rows,
            "row_count": len(merged_rows),
        }
