const CORRUPT_STORAGE_PATTERN =
  /Block not found|Internal storage error|Query Storage failed|Resolve Identit/i;

export function isCorruptLocalStorageError(message: string): boolean {
  return CORRUPT_STORAGE_PATTERN.test(message);
}

export function errorDetail(err: unknown): string {
  if (err instanceof Error) {
    return err.stack?.trim() || err.message;
  }
  return String(err);
}

export type FormattedCoError = {
  summary: string;
  detail: string;
  corruptStorage: boolean;
};

export class CoOperationError extends Error {
  readonly detail: string;
  readonly corruptStorage: boolean;

  constructor(formatted: FormattedCoError) {
    super(formatted.summary);
    this.name = "CoOperationError";
    this.detail = formatted.detail;
    this.corruptStorage = formatted.corruptStorage;
  }
}

export function formatCoError(err: unknown): FormattedCoError {
  if (err instanceof CoOperationError) {
    return {
      summary: err.message,
      detail: err.detail,
      corruptStorage: err.corruptStorage,
    };
  }

  const detail = errorDetail(err);
  const corruptStorage = isCorruptLocalStorageError(detail);

  if (corruptStorage) {
    return {
      summary:
        "Local CO data is corrupted or incomplete. Stop the app, run `pnpm clear:data`, then restart with `pnpm tauri:dev`.",
      detail,
      corruptStorage: true,
    };
  }

  const firstLine = detail.split("\n").find((line) => line.trim().length > 0) ?? detail;
  const summary = firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
  return { summary, detail, corruptStorage: false };
}

export const RESET_LOCAL_DATA_HINT =
  "Reset local dev data: stop the app, run `pnpm clear:data`, then `pnpm tauri:dev`.";
