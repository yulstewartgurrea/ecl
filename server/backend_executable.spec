# server/backend_executable.spec
# -*- mode: python ; coding: utf-8 -*-

import sys
import os
import glob
import site
from pathlib import Path

# Automatically collect Python DLL and related runtime DLLs for Windows builds.
binaries = []
datas = []

# Add pythonXY.dll (e.g. python312.dll) from the Python used to run PyInstaller
py_major = sys.version_info.major
py_minor = sys.version_info.minor
py_dll_name = f"python{py_major}{py_minor}.dll"
py_dll_path = os.path.join(sys.base_prefix, py_dll_name)
if os.path.exists(py_dll_path):
    # copy to _internal folder inside dist
    binaries.append((py_dll_path, "_internal"))
else:
    # sometimes pythonDLL lives in sys.exec_prefix
    alt = os.path.join(sys.exec_prefix, py_dll_name)
    if os.path.exists(alt):
        binaries.append((alt, "_internal"))

# Add all DLLs under the Python 'DLLs' folder (if present)
dlls_dir = os.path.join(sys.base_prefix, "DLLs")
if os.path.isdir(dlls_dir):
    for dll in glob.glob(os.path.join(dlls_dir, "*.dll")):
        binaries.append((dll, "_internal"))

# Also include DLLs from the 'libs' or root if present (some installs put libs next to exe)
maybe_root_dll = os.path.join(sys.base_prefix, py_dll_name)
if os.path.exists(maybe_root_dll) and (maybe_root_dll, "_internal") not in binaries:
    binaries.append((maybe_root_dll, "_internal"))

# Collect .pyd (C extension modules) from site-packages (helps include extension modules PyInstaller misses)
site_paths = []
try:
    site_paths = site.getsitepackages()
except Exception:
    # fallback to usersite if getsitepackages not available
    try:
        site_paths = [site.getusersitepackages()]
    except Exception:
        site_paths = []

# site.getsitepackages() may raise on virtualenvs in some envs; safe-guard above
for sdir in site_paths:
    if not sdir or not os.path.isdir(sdir):
        continue
    # find .pyd recursively and add them preserving relative dir structure under _pyd/
    for pyd in glob.glob(os.path.join(sdir, "**", "*.pyd"), recursive=True):
        # compute a relative dest (so multiple site-packages don't clash)
        rel_dir = os.path.relpath(os.path.dirname(pyd), sdir)
        dest = os.path.join("_pyd", rel_dir)
        binaries.append((pyd, dest))

# (Optional) include any extra data files from your server folder if needed.
# Example: datas.append(("path/to/datafile", "data_dest"))

# remove duplicates preserving order
seen = set()
unique_binaries = []
for src, dest in binaries:
    key = (os.path.abspath(src), dest)
    if key not in seen:
        seen.add(key)
        unique_binaries.append((src, dest))

binaries = unique_binaries

# --- original Analysis block, replace hiddenimports / pathex as you need ---
a = Analysis(
    ['main.py'],
    pathex=[os.path.abspath('.')],
    binaries=binaries,
    datas=datas,
   hiddenimports = [
    # Your own modules
    "database",

    # FastAPI & dependencies
    "fastapi",
    "pydantic",
    "starlette",

    # Passlib handlers (bcrypt + common others to avoid future errors)
    "passlib.handlers.bcrypt",
    "passlib.handlers.sha256_crypt",
    "passlib.handlers.sha512_crypt",
    "passlib.handlers.pbkdf2",
    "passlib.handlers.scrypt",
    "passlib.handlers.argon2",

    # SQLAlchemy
    "sqlalchemy",
    "sqlalchemy.orm",
    "sqlalchemy.ext.declarative",
    "sqlalchemy.sql",

    # Pandas / NumPy
    "pandas",
    "numpy",

    # Uvicorn (if used dynamically)
    "uvicorn",
    "uvicorn.config",
    "uvicorn.logging",
],

    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],  # runtime hooks here if needed
    exclude_binaries=True,
    name='backend_executable',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    # If UPX causes issues during packaging or causes runtime failures, set upx=False
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend_executable',
)
