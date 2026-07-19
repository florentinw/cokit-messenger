const CORRUPT_STORAGE_PATTERN =
  /Block not found|Internal storage error|Query Storage failed|Resolve Identit/i;

/**
 * True when an error message indicates local CO block storage is corrupt/incomplete.
 *
 * @param message - Raw error text (message or stack) to scan
 * @returns `true` if the text matches known corrupt-storage patterns
 */
function isCorruptLocalStorageError(message: string): boolean {
  return CORRUPT_STORAGE_PATTERN.test(message);
}

/**
 * Best-effort string for an unknown thrown value (prefers `Error.stack`).
 *
 * @param err - Any thrown value (`Error`, string, or other)
 * @returns Stack or message for `Error`; otherwise `String(err)`
 */
export function errorDetail(err: unknown): string {
  if (err instanceof Error) {
    return err.stack?.trim() || err.message;
  }
  return String(err);
}

/** Discriminator for normalized CO/Tauri errors. */
export type CoErrorType = "generic" | "corrupt_storage";

/** Normalized CO/Tauri error for UI banners and clipboard copy. */
export type FormattedCoError = {
  /** Error kind — drives UI (e.g. reset-data hint for `corrupt_storage`). */
  type: CoErrorType;
  /** Short user-facing line (truncated when long). */
  summary: string;
  /** Full technical detail (often a stack). */
  detail: string;
};

/** Error subclass that already carries a {@link FormattedCoError} payload. */
export class CoOperationError extends Error {
  /** Error kind from {@link FormattedCoError.type}. */
  readonly type: CoErrorType;
  /** Full technical detail from {@link FormattedCoError.detail}. */
  readonly detail: string;

  /**
   * @param formatted - Pre-normalized type/summary/detail
   */
  constructor(formatted: FormattedCoError) {
    super(formatted.summary);
    this.name = "CoOperationError";
    this.type = formatted.type;
    this.detail = formatted.detail;
  }
}

/**
 * Turn an unknown throw into a typed summary + full detail for the UI.
 * Classifies local-storage failure patterns as `type: "corrupt_storage"`.
 *
 * @param err - Any thrown value, including an existing {@link CoOperationError}
 * @returns Normalized `{ type, summary, detail }` for banners / copy
 */
export function formatCoError(err: unknown): FormattedCoError {
  if (err instanceof CoOperationError) {
    return {
      type: err.type,
      summary: err.message,
      detail: err.detail,
    };
  }

  const detail = errorDetail(err);

  if (isCorruptLocalStorageError(detail)) {
    return {
      type: "corrupt_storage",
      summary: "Local CO data is corrupted or incomplete.",
      detail,
    };
  }

  const firstLine = detail.split("\n").find((line) => line.trim().length > 0) ?? detail;
  const summary = firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
  return { type: "generic", summary, detail };
}
