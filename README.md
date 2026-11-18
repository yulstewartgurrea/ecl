# Project README

> Tauri + React frontend, FastAPI backend, Rust (Tauri), SQLite

This repository contains a desktop application built with **Tauri** (Rust) wrapping a **React** frontend, and a **FastAPI** backend that uses **SQLite** for local storage. The README below gives step-by-step instructions to clone, run, and build the app for development and production.

---

## Table of contents

* [Prerequisites](#prerequisites)
* [Clone the repo](#clone-the-repo)
* [Environment variables](#environment-variables)
* [Backend (FastAPI) — development](#backend-fastapi--development)
* [Frontend (React + Tauri) — development](#frontend-react--tauri--development)
* [Run the full app locally (recommended flow)](#run-the-full-app-locally-recommended-flow)
* [Create / initialize the SQLite DB](#create--initialize-the-sqlite-db)
* [Build & package (production)](#build--package-production)
* [Helpful scripts & package.json suggestions](#helpful-scripts--packagejson-suggestions)

---

## Prerequisites

Install the following on your machine before starting.

* **Git** (clone the repo)
* **Node.js** (LTS recommended, v16+)
* **npm** or **yarn**
* **Rust** toolchain (install via `rustup`) — required by Tauri
* **Tauri prerequisites** (platform dependent):

  * macOS: Xcode command line tools
  * Linux: `build-essential`, `libssl-dev`, `pkg-config`, `libgtk-3-dev` (varies by distro)
  * Windows: Visual Studio with Desktop development workload or the MSVC toolchain
* **Python 3.9+** and `pip` (for FastAPI)

Install `tauri` CLI (optional, you can use `npx`):

```bash
# Option A: use npx (no global install)
npx @tauri-apps/cli@latest # runs tauri commands without installing globally

# Option B: install globally (not required)
npm install -g @tauri-apps/cli
# or
cargo install tauri-cli
```

---

## Clone the repo

```bash
# clone
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
```

---

## Environment variables

Two `.env` files are required. Both are gitignored; copy the `.env.example` next to each and fill in real values.

**Frontend — `.env` (repo root)**, read by Vite at build time:

```env
VITE_AI_API_BASE=https://ai-api.example.com   # AI backend (login, chatbot)
VITE_AI_PASSWORD=change-me                    # shared password for the AI token
```

**Backend — `server/.env`**, read by FastAPI (`server/core/config.py`):

```env
SEED_ADMIN_PASSWORD=change-me   # password for the default "admin" account
SEED_USER_PASSWORD=change-me    # password for the default "user1"/"user2" accounts
# SECRET_KEY=...                # optional overrides
# DATABASE_URL=...
```

Default accounts are only created on first run, when the database has no user with that name. If a seed password is empty, that account is skipped.

`server/.env` is bundled into the installer with the `server/` folder. The CI build (`.github/workflows/build.yml`) writes both files from repository secrets of the same names.

---

## Backend (FastAPI) — development

Assuming your FastAPI app is in `backend/` (adjust paths if different):

```bash
# create & activate venv (macOS / Linux)
python -m venv .venv
source .venv/bin/activate

# windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# install requirements
pip install -r backend/requirements.txt

# create sqlite file (if not present)
touch backend/db.sqlite3
# or on Windows:
# type nul > backend\db.sqlite3

# run dev server with auto-reload
uvicorn backend.main:app --reload --host 0.0.0.0 --port ${PORT:-8000}
```

If you use `Poetry` or `pipenv`, use the corresponding commands.

---

## Frontend (React + Tauri) — development

Assuming your React frontend is in `frontend/` and Tauri config sits at project root (or inside `src-tauri`):

```bash
# install frontend deps
cd frontend
npm install
# or
# yarn install

# start React only (optional, useful to iterate UI fast)
npm run dev
# or
npm start

# start Tauri (this will build the frontend then start a desktop window)
# from the frontend folder (or repository root if configured):
npm run tauri dev
# or with npx
npx tauri dev

# Common note: if using CRA, replace dev commands with `npm start` then use `npx tauri dev` from project root
```

Tauri will spawn a desktop window and load the dev server (or the built frontend), depending on configuration.

---

## Run the full app locally (recommended flow)

1. Start the backend (FastAPI):

   ```bash
   cd backend
   source .venv/bin/activate
   uvicorn backend.main:app --reload
   ```
2. Start the frontend dev server (React):

   ```bash
   cd frontend
   npm install
   npm run dev   # or npm start
   ```
3. Start Tauri dev (in another terminal):

   ```bash
   cd frontend
   npx tauri dev
   ```

This setup gives you hot-reload for the frontend and backend while testing in the desktop window.

---

## Create / initialize the SQLite DB

If you use plain SQLAlchemy / raw SQL:

```bash
# create empty sqlite file (at backend path)
touch backend/db.sqlite3

# optionally run an initialization script (if provided)
python backend/scripts/init_db.py
```

If you use Alembic for migrations:

```bash
cd backend
alembic upgrade head
```

---

## Build & package (production)

1. Build the frontend for production

```bash
cd frontend
npm run build
# This generates the production assets (e.g. in `dist` or `build` folder)
```

2. Build the Tauri bundle (from the frontend folder or project root depending on config):

```bash
# using npx (recommended)
npx tauri build

# or using installed CLI
npm run tauri build
# or
cargo tauri build
```

This will produce OS-native installers/bundles in `src-tauri/target/release/bundle` (location may vary).

If your backend must be bundled with the Tauri app (for a standalone desktop binary), you have a few options:

* Bundle the backend as a background process (compile into the Tauri binary as Rust) — advanced.
* Ship the backend as a small Python executable or include the Python runtime (larger installers).
* Use Tauri IPC and embed data locally (preferred for pure client-only apps).

---

## Helpful scripts & package.json suggestions

Add these `scripts` to your frontend `package.json` for convenience:

```json
"scripts": {
  "dev": "vite",          // or react-scripts start
  "build": "vite build", // or react-scripts build
  "preview": "vite preview",
  "tauri": "tauri"        // if you installed @tauri-apps/cli
}
```

Add a `Makefile` or root npm scripts to orchestrate starting backend + frontend in dev.

---

## Troubleshooting

* **Tauri fails to build (Rust toolchain issues)**: Ensure `rustup` installed and you have a stable toolchain; run `rustup update`.
* **Missing native deps on Linux**: install `build-essential`, `libssl-dev`, `pkg-config` and `libgtk-3-dev` (or appropriate packages for your distro).
* **Backend can't find DB**: ensure `DATABASE_URL` is correct and points to `sqlite:///./db.sqlite3` relative to the working dir.
* **CORS problems**: if React dev server ([http://localhost:3000](http://localhost:3000)) calls FastAPI ([http://localhost:8000](http://localhost:8000)), enable CORS in FastAPI:

```py
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:3000"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)
```

* **Tauri dev shows an blank window**: check console logs; ensure frontend dev server is running and Tauri config `devPath` points to correct URL (e.g., `http://localhost:3000`).
