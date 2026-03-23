from __future__ import annotations

import json
from pathlib import Path

from app.models.dashboard_config import DashboardConfig
from app.models.data_source_config import DataSourceConfig

CONFIG_DIR = Path(__file__).parent.parent / "config"


class ConfigStore:
    def __init__(self) -> None:
        self._dashboards: dict[str, DashboardConfig] = {}
        self._data_sources: dict[str, DataSourceConfig] = {}
        self._load_configs()

    def _load_configs(self) -> None:
        dashboards_dir = CONFIG_DIR / "dashboards"
        if dashboards_dir.exists():
            for f in dashboards_dir.glob("*.json"):
                raw = json.loads(f.read_text())
                config = DashboardConfig.model_validate(raw)
                self._dashboards[config.id] = config

        data_sources_dir = CONFIG_DIR / "data_sources"
        if data_sources_dir.exists():
            for f in data_sources_dir.glob("*.json"):
                raw = json.loads(f.read_text())
                config = DataSourceConfig.model_validate(raw)
                self._data_sources[config.id] = config

    def list_dashboards(self) -> list[DashboardConfig]:
        return list(self._dashboards.values())

    def get_dashboard(self, dashboard_id: str) -> DashboardConfig | None:
        return self._dashboards.get(dashboard_id)

    def get_data_source(self, data_source_id: str) -> DataSourceConfig | None:
        return self._data_sources.get(data_source_id)

    def list_data_sources(self) -> list[DataSourceConfig]:
        return list(self._data_sources.values())
