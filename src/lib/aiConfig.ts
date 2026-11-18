// External AI service settings, read from Vite env vars at build time.
// Set them in `.env` (see `.env.example`); they are baked into the bundle.

const trimSlash = (v: string | undefined) => (v ?? "").trim().replace(/\/+$/, "");

/** Base URL of the AI backend (login, chatbot upload/stream). */
export const AI_API_BASE = trimSlash(import.meta.env.VITE_AI_API_BASE);

/** Shared password used to obtain an AI token after app login. */
export const AI_PASSWORD = import.meta.env.VITE_AI_PASSWORD ?? "";

if (!AI_API_BASE || !AI_PASSWORD) {
  console.warn(
    "AI settings missing: set VITE_AI_API_BASE and VITE_AI_PASSWORD in .env. AI features are disabled.",
  );
}
