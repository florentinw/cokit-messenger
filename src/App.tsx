import { useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { AppShell } from "./components/AppShell";
import { Icon } from "./components/Icon";

function fullErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.stack?.trim() || error.message || String(error);
  }
  return String(error);
}

function Fallback({ error }: FallbackProps) {
  const [copied, setCopied] = useState(false);
  const title = "Something went wrong";
  const message = fullErrorText(error);

  async function copyError() {
    await navigator.clipboard.writeText(`${title}\n\n${message}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full items-center justify-center bg-bg-elevated p-8 text-primary">
      <div className="max-w-md rounded-xl bg-bg-base p-6 shadow">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-semibold">{title}</h1>
          <button
            type="button"
            onClick={() => void copyError()}
            aria-label="Copy error"
            className="btn-icon"
            title={copied ? "Copied" : "Copy error"}
          >
            <Icon name="copy" className="text-primary" />
          </button>
        </div>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-secondary">
          {message}
        </pre>
        {copied && (
          <p className="mt-2 text-[11px] text-secondary">Copied to clipboard</p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 flex h-7 items-center justify-center rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:opacity-90"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <AppShell />
    </ErrorBoundary>
  );
}
