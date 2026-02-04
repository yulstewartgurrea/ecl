export type NormalizedUploadError = {
  title: string;
  userMessage: string;
  userAction: string;
  issueMessages?: string[];
  debugDetails?: string;
};

const DEFAULT_MESSAGE =
  "We could not validate this file. Please check the file and try again.";
const DEFAULT_ACTION =
  "Please upload the correct file format and try again.";

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function pickMessage(obj: any): string | undefined {
  const direct =
    asString(obj?.message) ||
    asString(obj?.detail) ||
    asString(obj?.error) ||
    asString(obj?.msg);
  if (direct) return direct;

  const errors = obj?.errors || obj?.data?.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return asString(errors[0]?.message) || asString(errors[0]);
  }

  const vr = obj?.data?.validation_results || obj?.validation_results;
  if (vr) {
    const vrMessage =
      asString(vr?.message) ||
      (Array.isArray(vr?.errors) && vr.errors.length
        ? asString(vr.errors[0]?.message) || asString(vr.errors[0])
        : undefined);
    if (vrMessage) return vrMessage;
  }

  return undefined;
}

function extractValidationIssues(input: unknown): string[] {
  if (!input || typeof input !== "object") return [];

  const obj: any = input;
  const vr = obj?.data?.validation_results || obj?.validation_results;
  const issues = Array.isArray(vr?.issues) ? vr.issues : [];

  const messages = issues
    .map((issue: any) => {
      const msg = asString(issue?.message);
      if (msg) return msg;

      const column = asString(issue?.column);
      const type = asString(issue?.type);
      if (column && type) return `Column "${column}" has issue: ${type}`;
      if (column) return `Column "${column}" has an issue`;
      if (type) return `Issue type: ${type}`;
      return undefined;
    })
    .filter((m): m is string => Boolean(m));

  return messages;
}

function buildDebugDetails(input: unknown): string | undefined {
  if (input == null) return undefined;
  if (typeof input === "string") return `Message: ${input}`;
  if (Array.isArray(input) && input.length > 0) {
    const inner = buildDebugDetails(input[0]);
    return inner ? `First error:\n${inner}` : undefined;
  }
  if (typeof input !== "object") return `Message: ${String(input)}`;

  const obj: any = input;
  const lines: string[] = [];

  const status = asString(obj?.status);
  if (status) lines.push(`Status: ${status}`);
  const code = asString(obj?.code);
  if (code) lines.push(`Code: ${code}`);
  const msg = pickMessage(obj);
  if (msg) lines.push(`Message: ${msg}`);

  const vr = obj?.data?.validation_results || obj?.validation_results;
  const vrStatus = asString(vr?.validation_status);
  if (vrStatus) lines.push(`Validation status: ${vrStatus}`);

  const vrErrors = vr?.errors;
  if (Array.isArray(vrErrors) && vrErrors.length > 0) {
    const first = asString(vrErrors[0]?.message) || asString(vrErrors[0]);
    if (first) lines.push(`Validation error: ${first}`);
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function normalizeUploadError(input: unknown): NormalizedUploadError {
  let message: string | undefined;
  if (typeof input === "string") {
    message = input;
  } else if (Array.isArray(input)) {
    message = input.length ? normalizeUploadError(input[0]).userMessage : undefined;
  } else if (input && typeof input === "object") {
    message = pickMessage(input);
  }

  return {
    title: "Upload failed",
    userMessage: message || DEFAULT_MESSAGE,
    userAction: DEFAULT_ACTION,
    issueMessages: extractValidationIssues(input),
    debugDetails: buildDebugDetails(input),
  };
}
