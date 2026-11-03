"""Authenticated, context-bound encryption with a separately provisioned key ring."""
import json
import os

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from fastapi import HTTPException

MARKER = "__crm_encrypted_v1__"


def cipher():
    keys = [value.strip() for value in os.getenv("CRM_ENCRYPTION_KEYS", "").split(",") if value.strip()]
    if not keys:
        raise HTTPException(503, detail={"code": "ENCRYPTION_NOT_CONFIGURED", "message": "The encryption key must be provisioned before using protected storage."})
    try:
        return MultiFernet([Fernet(key.encode()) for key in keys])
    except (ValueError, TypeError) as error:
        raise HTTPException(503, "Encryption configuration is invalid") from error


def sealed(value):
    return isinstance(value, dict) and set(value) == {MARKER}


def configured():
    try:
        cipher()
        return True
    except HTTPException:
        return False


def seal(value, context):
    payload = json.dumps({"context": context, "value": value}, separators=(",", ":"), allow_nan=False).encode()
    return {MARKER: cipher().encrypt(payload).decode()}


def unseal(value, context):
    if not sealed(value):
        return value
    try:
        payload = json.loads(cipher().decrypt(value[MARKER].encode()))
        if payload["context"] != context:
            raise ValueError("Context mismatch")
        return payload["value"]
    except (InvalidToken, ValueError, KeyError, TypeError) as error:
        raise HTTPException(503, "Protected data could not be decrypted; check the encryption key ring") from error
