"""Pydantic schemas for collections."""

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class CollectionItemCreate(BaseModel):
    """Schema for adding an item to a collection."""

    item_id: str
    item_type: str = Field(..., pattern="^(query|chart|dashboard)$")


class CollectionItemResponse(BaseModel):
    """Schema for collection item response."""

    id: str
    item_id: str
    item_type: str
    added_at: datetime
    # Resolved item details (populated when fetching)
    item_name: Optional[str] = None
    item_description: Optional[str] = None
    item_updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CollectionCreate(BaseModel):
    """Schema for creating a collection."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    color: str = Field(default="#3B82F6", pattern="^#[0-9A-Fa-f]{6}$")


class CollectionUpdate(BaseModel):
    """Schema for updating a collection."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    color: Optional[str] = Field(None, pattern="^#[0-9A-Fa-f]{6}$")


class CollectionResponse(BaseModel):
    """Schema for collection response (list view)."""

    id: str
    name: str
    description: Optional[str] = None
    color: str
    created_at: datetime
    updated_at: datetime
    item_count: int = 0

    class Config:
        from_attributes = True


class CollectionDetailResponse(BaseModel):
    """Schema for collection response with items (detail view)."""

    id: str
    name: str
    description: Optional[str] = None
    color: str
    created_at: datetime
    updated_at: datetime
    items: list[CollectionItemResponse] = []
    item_count: int = 0

    class Config:
        from_attributes = True
