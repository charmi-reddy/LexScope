"""Shared helpers for building the standard error envelope."""


def error_response(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}
