from datetime import date

from pydantic import BaseModel


class DateRange(BaseModel):
    from_date: date
    to_date: date


class GlobalFilters(BaseModel):
    date_range: DateRange | None = None
    entities: list[str] = []
    statuses: list[str] = []
    desks: list[str] = []


class SupersetFilter(BaseModel):
    col: str
    op: str
    val: str | list[str] | list[date]
