"""DatasetSyncService — syncs RecViz-managed datasets to Superset virtual datasets."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.db.models.dataset import RecvizDataset

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.services.superset_client import SupersetClient

logger = logging.getLogger(__name__)


class DatasetSyncService:
    """Manages synchronization of RecViz datasets with Superset."""

    def __init__(self, superset: SupersetClient) -> None:
        self._superset = superset

    async def sync_dataset(self, dataset: RecvizDataset) -> int | None:
        """Sync a single dataset to Superset.

        Creates a new virtual dataset if superset_id is None,
        otherwise updates the existing one.

        Returns the Superset dataset ID on success, None on failure.
        Per D-20: save succeeds even if sync fails.
        """
        try:
            if dataset.superset_id is None:
                # POST uses "database" key (not "database_id")
                payload = {
                    "database": dataset.database_id,
                    "table_name": f"recviz__{dataset.id}",
                    "sql": dataset.sql,
                    "schema": "",
                }
                result = await self._superset.create_dataset(payload)
                return result.get("id")
            else:
                # PUT uses "database_id" key (not "database")
                payload = {
                    "database_id": dataset.database_id,
                    "table_name": f"recviz__{dataset.id}",
                    "sql": dataset.sql,
                }
                await self._superset.update_dataset(dataset.superset_id, payload)
                return dataset.superset_id
        except Exception:
            logger.warning(
                "Failed to sync dataset '%s' (id=%s) to Superset",
                getattr(dataset, "name", "?"),
                dataset.id,
                exc_info=True,
            )
            return None

    async def reconcile(self, session: AsyncSession) -> None:
        """Re-sync all datasets that are not in 'synced' state.

        Called at startup to recover from previous sync failures.
        """
        stmt = select(RecvizDataset).where(RecvizDataset.sync_status != "synced")
        result = await session.execute(stmt)
        datasets = result.scalars().all()

        if not datasets:
            logger.info("No datasets need reconciliation")
            return

        logger.info("Reconciling %d unsynced dataset(s)", len(datasets))

        for ds in datasets:
            superset_id = await self.sync_dataset(ds)
            if superset_id is not None:
                ds.superset_id = superset_id
                ds.sync_status = "synced"
                logger.info("Reconciled dataset '%s' -> superset_id=%d", ds.name, superset_id)
            else:
                ds.sync_status = "error"
                logger.warning("Reconciliation failed for dataset '%s'", ds.name)

    async def delete_synced(self, superset_id: int | None) -> None:
        """Delete a dataset from Superset (non-blocking).

        If superset_id is None, this is a no-op.
        Failures are logged but do not raise.
        """
        if superset_id is None:
            return
        try:
            await self._superset.delete_dataset(superset_id)
        except Exception:
            logger.warning(
                "Failed to delete Superset dataset %d (non-blocking)",
                superset_id,
                exc_info=True,
            )
