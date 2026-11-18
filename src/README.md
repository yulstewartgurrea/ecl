# Frontend (src)

This folder contains the React + Redux frontend UI that users see and interact with in the app.

Project directory:
- `src/`

## Structure (high level)
- `components/` reusable UI building blocks (tables, modals, buttons)
- `hooks/` custom React hooks
- `lib/` shared helpers/utilities (parsing, API wrappers)
- `pages/` feature flows and steps (Overlay, ECL, Flowrate, etc.)
- `redux_toolkit/` Redux store, slices, and persisted state
- `services/` API calls and data fetching helpers
- `types/` shared TypeScript declaration files

## Run
- Start the frontend from the project root (see root README/scripts).

## Notes
- Feature steps live in `pages/**/steps/*`.
- Shared UI changes should go in `components/`.
- Most data comes from `services/`, then flows into components via props or Redux.

## Folder overview
- `components/` UI components grouped by feature and shared controls.
- `hooks/` reusable hooks like auth/login helpers.
- `lib/` utilities such as API wrappers and data coercers.
- `pages/` route pages and step-based workflows.
- `redux_toolkit/` store setup, slices, and persistence config.
- `services/` API modules used by pages/components.
- `types/` TypeScript type declarations for external libs.
