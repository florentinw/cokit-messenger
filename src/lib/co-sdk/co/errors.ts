const CORRUPT_STORAGE_PATTERN =
  /Block not found|Internal storage error|Query Storage failed|Resolve Identit/i;

/** Discriminator for CO/Tauri operation errors. */
export type CoErrorType = "generic" | "corrupt_storage";

function detailFromUnknown(err: unknown): string {
  if (err instanceof Error) {
    return err.stack?.trim() || err.message;
  }
  return String(err);
}

/**
 * CO/Tauri operation error with UI-facing `type`, summary (`message`), and `detail`.
 * Use {@link CoOperationError.from} at SDK boundaries for unknown throws.
 */
export class CoOperationError extends Error {
  readonly type: CoErrorType;
  readonly detail: string;

  constructor(type: CoErrorType, summary: string, detail: string) {
    super(summary);
    this.name = "CoOperationError";
    this.type = type;
    this.detail = detail;
  }

  /**
   * Normalize an unknown throw into a {@link CoOperationError}.
   * Classifies local-storage failure patterns as `type: "corrupt_storage"`.
   */
  static from(err: unknown): CoOperationError {
    if (err instanceof CoOperationError) return err;

    const detail = detailFromUnknown(err);

    if (CORRUPT_STORAGE_PATTERN.test(detail)) {
      return new CoOperationError(
        "corrupt_storage",
        "Local CO data is corrupted or incomplete.",
        detail,
      );
    }

    const firstLine = detail.split("\n").find((line) => line.trim().length > 0) ?? detail;
    const summary = firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
    return new CoOperationError("generic", summary, detail);
  }
}
