export function TopBar({ fileName, onReset }: { fileName?: string; onReset?: () => void }) {
  return (
    <header className="bg-card border-b border-border sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-extrabold text-lg">
            R
          </div>
          <div>
            <p className="font-extrabold text-foreground text-lg leading-tight tracking-tight">
              <span className="text-primary">Rappi</span>
            </p>
            <p className="text-xs text-muted-foreground -mt-0.5">Store Availability Dashboard</p>
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
