import { isTauri } from "@tauri-apps/api/core";

/**
 * True inside the Tauri desktop app, false in a plain browser (e.g. the Vercel web build).
 * The desktop app starts a local FastAPI backend and requires login + terms acceptance;
 * the web build has no backend, so it skips those and opens the dashboard directly.
 */
export const IS_DESKTOP = isTauri();

/** Landing page for the web build. */
export const WEB_HOME = "/workflows";
