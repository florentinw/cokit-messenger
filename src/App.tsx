import { useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { AppShell } from "./components/AppShell";
import { Button } from "./components/global/Button";
import { Icon } from "./components/global/icons/Icon";

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
    <div className="layer-ground flex h-full w-full flex-col bg-surface text-foreground">
      <div
        data-tauri-drag-region
        className="h-12 shrink-0"
        aria-hidden="true"
      />
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="layer-card max-w-md rounded-xl bg-surface p-6 shadow">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-lg font-semibold">{title}</h1>
            <Button
              variant="icon"
              onPress={() => void copyError()}
              aria-label={copied ? "Copied" : "Copy error"}
            >
              <Icon name={copied ? "check" : "copy"} />
            </Button>
          </div>
          <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap break-words type-body-regular text-muted">
            {message}
          </pre>
          <Button
            variant="bare"
            onPress={() => window.location.reload()}
            className="layer-accent interactive mt-4 flex h-7 items-center justify-center rounded-lg border-0 bg-surface px-3 type-body text-foreground"
          >
            Reload
          </Button>
        </div>
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
