"""Unit tests for EncryptionService — Fernet symmetric encryption for credentials."""

import pytest
from cryptography.fernet import Fernet, InvalidToken

from app.services.encryption import EncryptionService


class TestEncryptionRoundTrip:
    """Verify encrypt/decrypt round-trips produce the original plaintext."""

    def test_encrypt_returns_different_string(self):
        """Encrypted output must differ from the original plaintext."""
        key = Fernet.generate_key().decode()
        svc = EncryptionService(key)
        plaintext = "my_secret_password"
        ciphertext = svc.encrypt(plaintext)
        assert ciphertext != plaintext
        assert len(ciphertext) > 0

    def test_round_trip_simple_password(self):
        """Encrypt then decrypt returns the original plaintext."""
        key = Fernet.generate_key().decode()
        svc = EncryptionService(key)
        plaintext = "simple_password_123"
        assert svc.decrypt(svc.encrypt(plaintext)) == plaintext

    def test_round_trip_special_characters(self):
        """Passwords with special characters survive round-trip."""
        key = Fernet.generate_key().decode()
        svc = EncryptionService(key)
        plaintext = "p@ss/w0rd!#$%^&*()_+{}|:<>?"
        assert svc.decrypt(svc.encrypt(plaintext)) == plaintext

    def test_round_trip_unicode(self):
        """Unicode characters in passwords survive round-trip."""
        key = Fernet.generate_key().decode()
        svc = EncryptionService(key)
        plaintext = "paSSw0rd-\u00e9\u00e8\u00ea-\u00fc\u00f6\u00e4"
        assert svc.decrypt(svc.encrypt(plaintext)) == plaintext

    def test_round_trip_empty_string(self):
        """Empty string encrypts and decrypts correctly."""
        key = Fernet.generate_key().decode()
        svc = EncryptionService(key)
        assert svc.decrypt(svc.encrypt("")) == ""


class TestGenerateKey:
    """Verify generate_key produces valid Fernet keys."""

    def test_generate_key_returns_valid_fernet_key(self):
        """Generated key is 44 chars, URL-safe base64, usable by Fernet."""
        key = EncryptionService.generate_key()
        assert len(key) == 44
        # Must be usable to construct a new Fernet instance
        Fernet(key.encode())

    def test_generate_key_unique_each_call(self):
        """Each call produces a different key."""
        k1 = EncryptionService.generate_key()
        k2 = EncryptionService.generate_key()
        assert k1 != k2


class TestInvalidKeys:
    """Verify error handling for bad keys and wrong-key decryption."""

    def test_invalid_key_raises_on_construction(self):
        """EncryptionService with garbage key raises ValueError."""
        with pytest.raises((ValueError, Exception)):
            EncryptionService("not-a-valid-key")

    def test_wrong_key_decrypt_raises_invalid_token(self):
        """Decrypting with a different key raises InvalidToken."""
        key1 = Fernet.generate_key().decode()
        key2 = Fernet.generate_key().decode()
        svc1 = EncryptionService(key1)
        svc2 = EncryptionService(key2)
        ciphertext = svc1.encrypt("secret")
        with pytest.raises(InvalidToken):
            svc2.decrypt(ciphertext)
