from __future__ import annotations


class MergeEngine:
    @staticmethod
    def merge(
        results: list[dict],
        merge_on: list[str],
        merge_type: str = "outer_join",
        coalesce_zero: bool = False,
    ) -> dict:
        if merge_type not in ("outer_join", "inner_join"):
            raise ValueError(f"Unsupported merge_type: {merge_type}")
        if not results:
            return {"columns": [], "rows": [], "row_count": 0}
        if len(results) == 1:
            return {**results[0], "rows": list(results[0]["rows"])}

        merged = results[0]
        for i in range(1, len(results)):
            merged = MergeEngine._merge_two(
                merged, results[i], merge_on, merge_type, coalesce_zero
            )
        return merged

    @staticmethod
    def _merge_two(
        left: dict,
        right: dict,
        merge_on: list[str],
        merge_type: str,
        coalesce_zero: bool,
    ) -> dict:
        def make_key(row: dict) -> tuple:
            return tuple(row.get(k) for k in merge_on)

        # Columns can arrive as list[dict] (real query_engine output, with
        # {column_name, name, type, is_date}) or list[str] (test fixtures).
        # Handle both shapes uniformly.
        def col_name(col):
            return col["column_name"] if isinstance(col, dict) else col

        def col_type(col) -> str | None:
            return col.get("type") if isinstance(col, dict) else None

        right_index: dict[tuple, dict] = {}
        for row in right["rows"]:
            right_index[make_key(row)] = row

        # Build union of column metadata. Preserve left ordering then append
        # unseen right-side columns by name.
        left_names = {col_name(c) for c in left["columns"]}
        all_columns = list(left["columns"])
        for col in right["columns"]:
            if col_name(col) not in left_names:
                all_columns.append(col)

        # Numeric columns participating in zero-fill. Driven by cursor-detected
        # types; strings/dates stay absent (so a missing recon name doesn't
        # render as the literal "0").
        numeric_columns: set[str] = set()
        if coalesce_zero:
            for col in all_columns:
                if col_type(col) == "number":
                    numeric_columns.add(col_name(col))

        left_col_names = {col_name(c) for c in left["columns"]}
        right_col_names = {col_name(c) for c in right["columns"]}

        def fill_missing_zeros(row: dict, present_columns: set[str]) -> dict:
            if not coalesce_zero:
                return row
            for cname in numeric_columns:
                if cname not in present_columns:
                    row[cname] = 0
            return row

        merged_rows = []
        seen_keys = set()

        for lrow in left["rows"]:
            key = make_key(lrow)
            seen_keys.add(key)
            rrow = right_index.get(key)
            if rrow is not None:
                merged_rows.append({**lrow, **rrow})
            elif merge_type == "outer_join":
                # Left-only — right-side numeric columns get 0
                merged_rows.append(fill_missing_zeros({**lrow}, left_col_names))

        if merge_type == "outer_join":
            for rrow in right["rows"]:
                if make_key(rrow) not in seen_keys:
                    # Right-only — left-side numeric columns get 0
                    merged_rows.append(fill_missing_zeros({**rrow}, right_col_names))

        return {
            "columns": all_columns,
            "rows": merged_rows,
            "row_count": len(merged_rows),
        }
