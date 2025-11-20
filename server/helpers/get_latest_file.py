from pathlib import Path
from typing import Optional

def get_latest_file(folder_path: str | Path) -> Optional[Path]:
    folder = Path(folder_path)

    if not folder.is_dir():
        return None

    # Collect only files
    files = [f for f in folder.iterdir() if f.is_file()]

    if not files:
        return None

    # Return file with latest modified timestamp
    return max(files, key=lambda f: f.stat().st_mtime)