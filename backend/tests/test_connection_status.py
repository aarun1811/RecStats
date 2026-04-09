"""Unit tests for ConnectionStatusTracker."""

from app.services.connection_status import ConnectionStatusTracker


def test_get_status_unknown_id():
    """Unknown IDs return untested status with no last_tested."""
    tracker = ConnectionStatusTracker()
    status = tracker.get_status("uuid-unknown")
    assert status["status"] == "untested"
    assert status["last_tested"] is None


def test_mark_connected():
    """mark_connected sets status to 'connected' with a timestamp."""
    tracker = ConnectionStatusTracker()
    tracker.mark_connected("uuid-1")
    status = tracker.get_status("uuid-1")
    assert status["status"] == "connected"
    assert status["last_tested"] is not None


def test_mark_unreachable():
    """mark_unreachable sets status to 'unreachable' with a timestamp."""
    tracker = ConnectionStatusTracker()
    tracker.mark_unreachable("uuid-1")
    status = tracker.get_status("uuid-1")
    assert status["status"] == "unreachable"
    assert status["last_tested"] is not None


def test_overwrite_unreachable_with_connected():
    """mark_connected after mark_unreachable overwrites to 'connected'."""
    tracker = ConnectionStatusTracker()
    tracker.mark_unreachable("uuid-1")
    assert tracker.get_status("uuid-1")["status"] == "unreachable"
    tracker.mark_connected("uuid-1")
    assert tracker.get_status("uuid-1")["status"] == "connected"


def test_remove():
    """remove() clears tracked status, returning to untested default."""
    tracker = ConnectionStatusTracker()
    tracker.mark_connected("uuid-1")
    tracker.remove("uuid-1")
    status = tracker.get_status("uuid-1")
    assert status["status"] == "untested"
    assert status["last_tested"] is None


def test_multiple_databases():
    """Different database IDs tracked independently."""
    tracker = ConnectionStatusTracker()
    tracker.mark_connected("uuid-1")
    tracker.mark_unreachable("uuid-2")
    assert tracker.get_status("uuid-1")["status"] == "connected"
    assert tracker.get_status("uuid-2")["status"] == "unreachable"
    assert tracker.get_status("uuid-3")["status"] == "untested"
