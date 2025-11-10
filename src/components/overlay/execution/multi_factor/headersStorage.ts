// Simple localStorage helpers for Step4/Step5

const keyHeaders = (wfId: number | string) => `overlay:mf:step4:headers:${wfId}`;
const keyFilters = (wfId: number | string) => `overlay:mf:step5:filters:${wfId}`;

export type FilterRule = { id: string; column: string; value: string };

export function saveHeaders(wfId: number | string, headers: string[]) {
  try {
    localStorage.setItem(keyHeaders(wfId), JSON.stringify(headers));
  } catch {}
}

export function loadHeaders(wfId: number | string): string[] {
  try {
    const raw = localStorage.getItem(keyHeaders(wfId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveFilters(wfId: number | string, rules: FilterRule[]) {
  try {
    localStorage.setItem(keyFilters(wfId), JSON.stringify(rules));
  } catch {}
}

export function loadFilters(wfId: number | string): FilterRule[] {
  try {
    const raw = localStorage.getItem(keyFilters(wfId));
    return raw ? (JSON.parse(raw) as FilterRule[]) : [];
  } catch {
    return [];
  }
}