type Props = {
  message?: string;
};

export function IdentityLoadingScreen({
  message = "Setting up your identity…",
}: Props) {
  return (
    <div className="layer-ground flex h-full w-full flex-col bg-surface">
      <div
        data-tauri-drag-region
        className="h-12 shrink-0"
        aria-hidden="true"
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8">
        <div
          className="loading-spinner"
          role="status"
          aria-label="Loading"
        />
        <p className="type-body-regular text-muted">{message}</p>
      </div>
    </div>
  );
}
