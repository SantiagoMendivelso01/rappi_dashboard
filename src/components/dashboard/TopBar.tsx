import rappiLogo from "@/assets/rappi-logo.png";

export function TopBar({ fileName, onReset }: { fileName?: string; onReset?: () => void }) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={rappiLogo}
            alt="Rappi"
            className="h-9 w-auto object-contain"
          />
          <div className="hidden sm:block pl-3 border-l border-border">
            <p className="text-xs text-muted-foreground">Store Availability Dashboard</p>
          </div>
        </div>
        {fileName && (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-muted-foreground">
              Archivo: <span className="font-medium text-foreground">{fileName}</span>
            </span>
            <button
              onClick={onReset}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Cargar otro
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
