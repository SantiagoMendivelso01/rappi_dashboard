import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet } from "lucide-react";

type Props = {
  onFile: (text: string, name: string) => void;
  loading?: boolean;
};

export function FileDropzone({ onFile, loading }: Props) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setError("El archivo debe tener extensión .csv");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = String(e.target?.result ?? "");
        onFile(text, file.name);
      };
      reader.onerror = () => setError("No se pudo leer el archivo.");
      reader.readAsText(file);
    },
    [onFile]
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground">Carga tu archivo de datos</h2>
        <p className="text-muted-foreground mt-2">
          Sube un CSV con el historial de tiendas visibles para visualizar el dashboard completo.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handle(f);
        }}
        className={`card-rappi border-2 border-dashed transition-all p-12 text-center cursor-pointer ${
          drag ? "border-primary bg-accent" : "border-border"
        }`}
        onClick={() => document.getElementById("csv-input")?.click()}
      >
        <input
          id="csv-input"
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
          }}
        />
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <p className="text-lg font-semibold text-foreground">
          {drag ? "Suelta el archivo aquí" : "Arrastra tu CSV aquí"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionarlo</p>

        <button
          type="button"
          disabled={loading}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-rappi-orange-light disabled:opacity-50"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {loading ? "Procesando..." : "Cargar CSV"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive text-center">
          {error}
        </div>
      )}

      <div className="mt-8 text-xs text-muted-foreground text-center">
        Columnas esperadas: <code className="font-mono">timestamp, visible_stores, date, hour, day_of_week...</code>
      </div>
    </div>
  );
}
