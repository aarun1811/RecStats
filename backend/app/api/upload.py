"""File upload API endpoints."""

import json
import os
from pathlib import Path
from uuid import uuid4

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.db.models import UploadedFile

router = APIRouter()
settings = get_settings()


def ensure_upload_dir():
    """Ensure upload directory exists."""
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)


@router.post("/csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a CSV file."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    ensure_upload_dir()

    # Read file content
    content = await file.read()
    size_bytes = len(content)

    # Check size limit
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if size_bytes > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB",
        )

    # Generate unique filename
    file_id = str(uuid4())
    stored_filename = f"{file_id}.csv"
    file_path = os.path.join(settings.upload_dir, stored_filename)

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse CSV to get metadata
    try:
        df = pd.read_csv(file_path, nrows=1000)  # Read first 1000 rows for analysis
        row_count = len(pd.read_csv(file_path))  # Get actual row count
        columns = [
            {"name": col, "data_type": str(df[col].dtype)}
            for col in df.columns
        ]
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    # Save metadata to database
    uploaded_file = UploadedFile(
        id=file_id,
        filename=stored_filename,
        original_name=file.filename,
        file_type="csv",
        size_bytes=size_bytes,
        row_count=row_count,
        columns=json.dumps(columns),
    )
    db.add(uploaded_file)
    await db.commit()
    await db.refresh(uploaded_file)

    return {
        "id": uploaded_file.id,
        "filename": uploaded_file.original_name,
        "size_bytes": uploaded_file.size_bytes,
        "row_count": uploaded_file.row_count,
        "columns": columns,
    }


@router.post("/excel")
async def upload_excel(
    file: UploadFile = File(...),
    sheet_name: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Upload an Excel file."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")

    ensure_upload_dir()

    # Read file content
    content = await file.read()
    size_bytes = len(content)

    # Check size limit
    max_size = settings.max_upload_size_mb * 1024 * 1024
    if size_bytes > max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_upload_size_mb}MB",
        )

    # Generate unique filename
    file_id = str(uuid4())
    ext = ".xlsx" if file.filename.endswith(".xlsx") else ".xls"
    stored_filename = f"{file_id}{ext}"
    file_path = os.path.join(settings.upload_dir, stored_filename)

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Parse Excel to get metadata
    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name or 0, nrows=1000)
        full_df = pd.read_excel(file_path, sheet_name=sheet_name or 0)
        row_count = len(full_df)
        columns = [
            {"name": col, "data_type": str(df[col].dtype)}
            for col in df.columns
        ]
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel: {str(e)}")

    # Save metadata to database
    uploaded_file = UploadedFile(
        id=file_id,
        filename=stored_filename,
        original_name=file.filename,
        file_type="excel",
        size_bytes=size_bytes,
        row_count=row_count,
        columns=json.dumps(columns),
    )
    db.add(uploaded_file)
    await db.commit()
    await db.refresh(uploaded_file)

    return {
        "id": uploaded_file.id,
        "filename": uploaded_file.original_name,
        "size_bytes": uploaded_file.size_bytes,
        "row_count": uploaded_file.row_count,
        "columns": columns,
    }


@router.get("/files")
async def list_uploaded_files(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """List all uploaded files."""
    result = await db.execute(
        select(UploadedFile)
        .offset(skip)
        .limit(limit)
        .order_by(UploadedFile.created_at.desc())
    )
    files = result.scalars().all()

    return [
        {
            "id": f.id,
            "filename": f.original_name,
            "file_type": f.file_type,
            "size_bytes": f.size_bytes,
            "row_count": f.row_count,
            "columns": json.loads(f.columns) if f.columns else [],
            "created_at": f.created_at,
        }
        for f in files
    ]


@router.get("/files/{file_id}")
async def get_uploaded_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get uploaded file metadata."""
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    uploaded_file = result.scalar_one_or_none()
    if not uploaded_file:
        raise HTTPException(status_code=404, detail="File not found")

    return {
        "id": uploaded_file.id,
        "filename": uploaded_file.original_name,
        "file_type": uploaded_file.file_type,
        "size_bytes": uploaded_file.size_bytes,
        "row_count": uploaded_file.row_count,
        "columns": json.loads(uploaded_file.columns) if uploaded_file.columns else [],
        "created_at": uploaded_file.created_at,
    }


@router.get("/files/{file_id}/preview")
async def preview_uploaded_file(
    file_id: str,
    rows: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """Preview uploaded file data."""
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    uploaded_file = result.scalar_one_or_none()
    if not uploaded_file:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = os.path.join(settings.upload_dir, uploaded_file.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File data not found")

    try:
        if uploaded_file.file_type == "csv":
            df = pd.read_csv(file_path, nrows=rows)
        else:
            df = pd.read_excel(file_path, nrows=rows)

        return {
            "columns": list(df.columns),
            "data": df.to_dict(orient="records"),
            "row_count": len(df),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")


@router.delete("/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_uploaded_file(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete an uploaded file."""
    result = await db.execute(select(UploadedFile).where(UploadedFile.id == file_id))
    uploaded_file = result.scalar_one_or_none()
    if not uploaded_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete file from disk
    file_path = os.path.join(settings.upload_dir, uploaded_file.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    # Delete from database
    await db.delete(uploaded_file)
    await db.commit()
