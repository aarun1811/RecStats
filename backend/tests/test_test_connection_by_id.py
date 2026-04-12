"""Tests for POST /api/databases/test with database_id (Unit 2, v7-safe)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models.connection import RecvizConnection
from app.services.encryption import EncryptionService


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def _make_request(encryption: EncryptionService, tracker=None) -> SimpleNamespace:
    return SimpleNamespace(
        app=SimpleNamespace(
            state=SimpleNamespace(
                encryption=encryption,
                connection_status=tracker,
            )
        )
    )


def _seed_oracle_connection(
    session: Session, encryption: EncryptionService
) -> RecvizConnection:
    conn = RecvizConnection(
        id="test-uuid",
        name="prod_oracle",
        display_name="Prod Oracle",
        backend="oracle",
        host="oracle.prod.example.com",
        port=1521,
        database_name="ORCL",
        schema_name="RECON",
        username="recon_user",
        encrypted_password=encryption.encrypt("secret123"),
        status="untested",
    )
    session.add(conn)
    session.commit()
    return conn


def test_test_connection_with_database_id_uses_stored_creds(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """When body has only database_id, the endpoint loads the connection
    row, uses the stored credentials, and persists status='connected'."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())
    conn = _seed_oracle_connection(sqlite_session, encryption)

    captured = {}

    def _fake_test_connection(uri: str, backend: str, timeout: int = 10):
        captured["uri"] = uri
        captured["backend"] = backend
        return True, "Connection successful"

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_fake_test_connection),
    )

    body = TestConnectionRequest(backend="oracle", database_id="test-uuid")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is True
    assert "oracle.prod.example.com" in captured["uri"]
    assert "recon_user" in captured["uri"]
    assert captured["backend"] == "oracle"

    sqlite_session.refresh(conn)
    assert conn.status == "connected"
    assert conn.last_tested_at is not None


def test_test_connection_with_explicit_body_bypasses_lookup(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """When body has explicit host, the endpoint uses the body verbatim
    and does NOT consult the stored row (backward compat with create/edit)."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())
    captured = {}

    def _fake_test_connection(uri: str, backend: str, timeout: int = 10):
        captured["uri"] = uri
        return True, "Connection successful"

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_fake_test_connection),
    )

    body = TestConnectionRequest(
        backend="oracle",
        host="new-host.example.com",
        port=1521,
        database="newdb",
        username="newuser",
        password="newpass",
    )
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is True
    assert "new-host.example.com" in captured["uri"]
    assert "newuser" in captured["uri"]


def test_test_connection_with_database_id_not_found_returns_failure(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """Detail-panel test against a non-existent database_id returns a
    structured failure, does NOT raise, does NOT reach EngineManager."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())

    def _should_not_be_called(*args, **kwargs):
        pytest.fail(
            "EngineManager.test_connection should not run when the row is missing"
        )

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_should_not_be_called),
    )

    body = TestConnectionRequest(backend="oracle", database_id="does-not-exist")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is False
    assert "not found" in result["message"].lower()


def test_test_connection_with_database_id_decrypt_failure(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """If the stored password cannot be decrypted (corrupt ciphertext or
    wrong key), the endpoint returns a generic client-safe failure — no
    ciphertext leak, and EngineManager is not called."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest
    from cryptography.fernet import InvalidToken

    encryption = EncryptionService(EncryptionService.generate_key())
    _seed_oracle_connection(sqlite_session, encryption)

    def _fail_decrypt(_ciphertext: str) -> str:
        raise InvalidToken()

    monkeypatch.setattr(encryption, "decrypt", _fail_decrypt)

    def _should_not_be_called(*args, **kwargs):
        pytest.fail(
            "EngineManager.test_connection should not run after a decrypt failure"
        )

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_should_not_be_called),
    )

    body = TestConnectionRequest(backend="oracle", database_id="test-uuid")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is False
    assert "decrypt" in result["message"].lower()
    assert "secret123" not in result["message"]


def test_test_connection_with_database_id_connect_failure_persists_unreachable(
    sqlite_session: Session, monkeypatch: pytest.MonkeyPatch
):
    """When the test against stored credentials fails (DB unreachable),
    the endpoint persists status='unreachable' + last_tested_at."""
    from app.api import databases as databases_api
    from app.models.database import TestConnectionRequest

    encryption = EncryptionService(EncryptionService.generate_key())
    conn = _seed_oracle_connection(sqlite_session, encryption)

    def _fake_test_connection(uri: str, backend: str, timeout: int = 10):
        return False, "ORA-12541: TNS:no listener"

    monkeypatch.setattr(
        databases_api.EngineManager,
        "test_connection",
        staticmethod(_fake_test_connection),
    )

    body = TestConnectionRequest(backend="oracle", database_id="test-uuid")
    result = databases_api.test_connection(
        body=body,
        session=sqlite_session,
        request=_make_request(encryption),  # type: ignore[arg-type]
    )

    assert result["success"] is False

    sqlite_session.refresh(conn)
    assert conn.status == "unreachable"
    assert conn.last_tested_at is not None
