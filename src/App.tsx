import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { AppShell } from "./components/AppShell";
import { ErrorCard } from "./components/global/ErrorCard";

function fullErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.stack?.trim() || error.message || String(error);
  }
  return String(error);
}

function Fallback({ error }: FallbackProps) {
  const title = "Something went wrong";
  const message = fullErrorText(error);
  return (
    <ErrorCard
      title={title}
      message={
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words type-body-regular text-muted">
          {message}
        </pre>
      }
      copyText={`${title}\n\n${message}`}
    />
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      <AppShell />
    </ErrorBoundary>
  );
}
