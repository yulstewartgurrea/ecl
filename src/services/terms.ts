// src/services/terms.ts
// Acceptance of the platform terms. The backend keeps every acceptance and never edits one.
import { request } from "./apiRequest";

export type TermsAcceptance = {
  id: number;
  username: string;
  app_version: string;
  terms_version: string;
  terms_hash: string;
  accepted_at: string;
};

export const getTermsAcceptance = (token: string, appVersion: string, termsHash: string) =>
  request<{ accepted: boolean; acceptance: TermsAcceptance | null }>(
    `/api/terms/acceptance?app_version=${encodeURIComponent(appVersion)}&terms_hash=${termsHash}`,
    token
  );

export const acceptTerms = (
  token: string,
  data: {
    app_version: string;
    terms_version: string;
    terms_hash: string;
    // the exact text that was hashed; the backend checks the hash and keeps the text
    terms_content: string;
  }
) => request<TermsAcceptance>("/api/terms/acceptance", token, { method: "POST", body: data });
