from pathlib import Path
from typing import Optional

from core.config import SERVER_DIR

FILES_ROOT = (SERVER_DIR / "files").resolve()


def resolve_in_files(*parts: str) -> Path:
    """
    Join parts under server/files and return the resolved path.

    Raises ValueError if the result would land outside server/files
    (e.g. "../../x", an absolute path, or a symlink pointing elsewhere).
    """
    target = FILES_ROOT.joinpath(*parts).resolve()
    if not target.is_relative_to(FILES_ROOT):
        raise ValueError("Path is outside the files folder")
    return target


def check_name(value: Optional[str]) -> Optional[str]:
    """
    Validate a name that is later used as one folder level under server/files
    (entity, workflow name, reporting period, loan product).
    """
    if value is None:
        return value
    if any(c in value for c in ("/", "\\", "\x00")) or value.strip() in (".", ".."):
        raise ValueError("Name cannot contain '/' or '\\', or be '.' or '..'")
    return value
