# Backend (src-tauri)

This folder contains the Tauri backend and native integrations that connect the UI to the desktop OS.

Project directory:
- `C:\Users\KC Trinidad\Desktop\SGV\ecl\src-tauri`

## Structure (high level)
- `src/` Rust backend code (commands, filesystem access)
- `tauri.conf.json` Tauri configuration and app metadata

## Run
- Build and run is managed from the project root (see root README/scripts).

## Notes
- Use this layer for filesystem access and native OS APIs.
- The frontend calls into this backend for tasks that require desktop permissions.
