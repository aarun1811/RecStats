# Deferred Items — Phase 01

## Out-of-scope issues discovered during execution

### 1. Test file references deleted `build_sqlalchemy_uri`
- **File:** `backend/tests/test_uri_builder.py`
- **Found during:** Plan 01-02, Task 2
- **Issue:** Test file imports `build_sqlalchemy_uri` which was removed from `uri_builder.py` (Oracle-only rewrite). Import will fail at test time.
- **Why deferred:** Tests are out of scope for this milestone (CLAUDE.md rule 6). No tests are being run.
- **Resolution:** Update test file when automated tests milestone begins.
