"""
Fernet symmetric encryption for sensitive data at rest.

All user API keys, SMTP passwords, OAuth tokens, and external DB credentials
are encrypted before being written to the database and decrypted only in-memory
when needed for server-side processing.

The master key is sourced from the ENCRYPTION_KEY environment variable and
never stored in the database or codebase.
"""
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings
from loguru import logger

_fernet = None

def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.ENCRYPTION_KEY
        if not key:
            logger.warning("ENCRYPTION_KEY not set — sensitive data will NOT be encrypted. Set it in .env for production.")
            return None
        # Fernet requires a 32-byte URL-safe base64-encoded key
        try:
            _fernet = Fernet(key.encode() if isinstance(key, str) else key)
        except Exception as e:
            logger.error(f"Invalid ENCRYPTION_KEY format: {e}. Generate one with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'")
            return None
    return _fernet


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string. Returns ciphertext string. Falls back to plaintext if no key configured."""
    if not plaintext:
        return plaintext
    f = _get_fernet()
    if f is None:
        return plaintext
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(ciphertext: str) -> str:
    """Decrypt a ciphertext string. Returns plaintext. Falls back to returning input if decryption fails."""
    if not ciphertext:
        return ciphertext
    f = _get_fernet()
    if f is None:
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # Data was stored before encryption was enabled — return as-is
        return ciphertext


# Sensitive field names in UserSetting that must be encrypted/decrypted
SENSITIVE_FIELDS = frozenset({
    "gemini_api_keys",
    "openai_api_key",
    "smtp_password",
    "gmail_access_token",
    "gmail_refresh_token",
    "external_db_url",
    "external_db_auth_key",
})
