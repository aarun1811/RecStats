"""Convert frontend GlobalFilters to Superset's filter format."""

from __future__ import annotations

from app.models.filters import GlobalFilters, SupersetFilter


def to_superset_filters(filters: GlobalFilters) -> list[SupersetFilter]:
    """Convert a GlobalFilters model to Superset's native filter list.

    Superset expects: [{"col": "desk", "op": "IN", "val": ["Operations"]}]
    """
    result: list[SupersetFilter] = []

    if filters.date_range:
        result.append(
            SupersetFilter(
                col="recon_date",
                op="TEMPORAL_RANGE",
                val=f"{filters.date_range.from_date} : {filters.date_range.to_date}",
            )
        )

    if filters.entities:
        result.append(
            SupersetFilter(col="entity", op="IN", val=filters.entities),
        )

    if filters.statuses:
        result.append(
            SupersetFilter(col="status", op="IN", val=filters.statuses),
        )

    if filters.desks:
        result.append(
            SupersetFilter(col="desk", op="IN", val=filters.desks),
        )

    return result
