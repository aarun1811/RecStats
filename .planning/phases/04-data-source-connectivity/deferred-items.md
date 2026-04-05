# Deferred Items — Phase 04

## Pre-existing Test Failures

1. **tests/test_config_store.py** — `ConfigStore.__init__()` signature changed (requires `session` arg). Test fixture not updated. Not caused by Phase 04 changes.
2. **tests/test_query_engine.py::test_build_sql_with_filters** — Same root cause: `ConfigStore()` in fixture missing `session` arg. Not caused by Phase 04 changes.
