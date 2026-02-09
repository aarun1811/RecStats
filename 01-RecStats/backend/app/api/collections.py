"""Collections API endpoints."""

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.db.models import Collection, CollectionItem, Query, Chart, Dashboard
from app.schemas.collection import (
    CollectionCreate,
    CollectionUpdate,
    CollectionResponse,
    CollectionDetailResponse,
    CollectionItemCreate,
    CollectionItemResponse,
)

router = APIRouter()


async def resolve_item_details(
    item: CollectionItem, db: AsyncSession
) -> CollectionItemResponse:
    """Resolve item name and description based on item_type."""
    item_name = None
    item_description = None
    item_updated_at = None

    if item.item_type == "query":
        result = await db.execute(select(Query).where(Query.id == item.item_id))
        query = result.scalar_one_or_none()
        if query:
            item_name = query.name
            item_description = query.description
            item_updated_at = query.updated_at
    elif item.item_type == "chart":
        result = await db.execute(select(Chart).where(Chart.id == item.item_id))
        chart = result.scalar_one_or_none()
        if chart:
            item_name = chart.name
            item_description = chart.description
            item_updated_at = chart.updated_at
    elif item.item_type == "dashboard":
        result = await db.execute(select(Dashboard).where(Dashboard.id == item.item_id))
        dashboard = result.scalar_one_or_none()
        if dashboard:
            item_name = dashboard.name
            item_description = dashboard.description
            item_updated_at = dashboard.updated_at

    return CollectionItemResponse(
        id=item.id,
        item_id=item.item_id,
        item_type=item.item_type,
        added_at=item.added_at,
        item_name=item_name,
        item_description=item_description,
        item_updated_at=item_updated_at,
    )


def collection_to_response(collection: Collection) -> CollectionResponse:
    """Convert collection model to response."""
    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        item_count=len(collection.items) if collection.items else 0,
    )


@router.post("", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    data: CollectionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new collection."""
    collection = Collection(
        id=str(uuid4()),
        name=data.name,
        description=data.description,
        color=data.color,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    return CollectionResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        item_count=0,
    )


@router.get("", response_model=list[CollectionResponse])
async def list_collections(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List all collections."""
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.items))
        .offset(skip)
        .limit(limit)
        .order_by(Collection.created_at.desc())
    )
    collections = result.scalars().all()
    return [collection_to_response(c) for c in collections]


@router.get("/{collection_id}", response_model=CollectionDetailResponse)
async def get_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a collection by ID with all items resolved."""
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.items))
        .where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Resolve item details
    resolved_items = []
    for item in collection.items:
        resolved_item = await resolve_item_details(item, db)
        # Only include items that still exist
        if resolved_item.item_name is not None:
            resolved_items.append(resolved_item)

    return CollectionDetailResponse(
        id=collection.id,
        name=collection.name,
        description=collection.description,
        color=collection.color,
        created_at=collection.created_at,
        updated_at=collection.updated_at,
        items=resolved_items,
        item_count=len(resolved_items),
    )


@router.put("/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: str,
    data: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a collection."""
    result = await db.execute(
        select(Collection)
        .options(selectinload(Collection.items))
        .where(Collection.id == collection_id)
    )
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if data.name is not None:
        collection.name = data.name
    if data.description is not None:
        collection.description = data.description
    if data.color is not None:
        collection.color = data.color

    await db.commit()
    await db.refresh(collection)

    return collection_to_response(collection)


@router.delete("/{collection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_collection(
    collection_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a collection."""
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    await db.delete(collection)
    await db.commit()


# Collection Items endpoints
@router.post(
    "/{collection_id}/items",
    response_model=CollectionItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_item_to_collection(
    collection_id: str,
    data: CollectionItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add an item (query/chart/dashboard) to a collection."""
    # Verify collection exists
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    # Verify item exists based on type
    if data.item_type == "query":
        result = await db.execute(select(Query).where(Query.id == data.item_id))
    elif data.item_type == "chart":
        result = await db.execute(select(Chart).where(Chart.id == data.item_id))
    elif data.item_type == "dashboard":
        result = await db.execute(select(Dashboard).where(Dashboard.id == data.item_id))
    else:
        raise HTTPException(status_code=400, detail="Invalid item_type")

    item_record = result.scalar_one_or_none()
    if not item_record:
        raise HTTPException(status_code=404, detail=f"{data.item_type.capitalize()} not found")

    # Check if item already in collection
    result = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.item_id == data.item_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Item already in collection")

    collection_item = CollectionItem(
        id=str(uuid4()),
        collection_id=collection_id,
        item_id=data.item_id,
        item_type=data.item_type,
    )
    db.add(collection_item)
    await db.commit()
    await db.refresh(collection_item)

    return CollectionItemResponse(
        id=collection_item.id,
        item_id=collection_item.item_id,
        item_type=collection_item.item_type,
        added_at=collection_item.added_at,
        item_name=item_record.name,
        item_description=getattr(item_record, "description", None),
        item_updated_at=item_record.updated_at,
    )


@router.delete(
    "/{collection_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_item_from_collection(
    collection_id: str,
    item_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Remove an item from a collection."""
    result = await db.execute(
        select(CollectionItem).where(
            CollectionItem.collection_id == collection_id,
            CollectionItem.item_id == item_id,
        )
    )
    collection_item = result.scalar_one_or_none()
    if not collection_item:
        raise HTTPException(status_code=404, detail="Item not in collection")

    await db.delete(collection_item)
    await db.commit()
