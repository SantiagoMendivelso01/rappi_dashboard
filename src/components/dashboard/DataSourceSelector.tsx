import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, Sparkles, FileCheck2, Loader2, AlertCircle } from "lucide-react";

type Mode = "choose" | "clean" | "dirty";

type Props = {
  onFile: (text: string, name: string) => void;
  loading?: boolean;
};

const HF_ENDPOINT = "https://smendivelso-rappi.hf.space/api/process_and_download";

export function DataSourceSelector({ onFile, loading }: Props) {
  const [mode, setMode] = useState<Mode>("choose");
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string>("");

  const readCleanFile = useCallback(
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

  const processDirtyFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setError("El archivo debe tener extensión .zip");
        return;
      }
      setProcessing(true);
      setProgressMsg("Subiendo archivo ZIP al servicio de procesamiento...");
      try {
        const formData = new FormData();
        formData.append("file", file);

        setProgressMsg("Procesando datos sucios (esto puede tardar un momento)...");
        const res = await fetch(HF_ENDPOINT, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`El servicio respondió con estado ${res.status}. Verifica el archivo e intenta de nuevo.`);
        }

        setProgressMsg("Descargando CSV limpio...");
        const text = await res.text();

        if (!text || text.trim().length === 0) {
          throw new Error("El servicio devolvió un archivo vacío.");
        }

        const cleanName = file.name.replace(/\.zip$/i, "_clean.csv");
        onFile(text, cleanName);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo procesar el archivo en el servicio externo."
        );
      } finally {
        setProcessing(false);
        setProgressMsg("");
      }
    },
    [onFile]
  );

  // ---------- Pantalla de elección ----------
  if (mode === "choose") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-foreground">¿Cómo están tus datos?</h2>
          <p className="text-muted-foreground mt-2">
            Elige el flujo según el estado de tu archivo CSV.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            onClick={() => setMode("clean")}
            className="card-rappi p-8 text-left transition-all hover:border-primary hover:shadow-lg group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <FileCheck2 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Datos limpios</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Ya tengo el CSV con las columnas <code className="font-mono text-xs">timestamp, visible_stores, date, hour...</code> listo para visualizar.
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Subir directo al dashboard →
            </span>
          </button>

          <button
            onClick={() => setMode("dirty")}
            className="card-rappi p-8 text-left transition-all hover:border-primary hover:shadow-lg group"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <Sparkles className="w-7 h-7 text-foreground group-hover:text-primary transition-colors" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Datos sucios</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Tengo el ZIP crudo. Lo enviaré al servicio de procesamiento para que lo limpie y cargue el CSV resultante al dashboard automáticamente.
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Procesar y cargar →
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- Dropzones (clean/dirty) ----------
  const isDirty = mode === "dirty";
  const handle = isDirty ? processDirtyFile : readCleanFile;
  const busy = loading || processing;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <button
        onClick={() => {
          setMode("choose");
          setError(null);
        }}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1"
        disabled={busy}
      >
        ← Cambiar tipo de datos
      </button>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-foreground">
          {isDirty ? "Sube tu archivo ZIP crudo" : "Carga tu CSV limpio"}
        </h2>
        <p className="text-muted-foreground mt-2">
          {isDirty
            ? "Lo enviaremos al servicio de procesamiento. Cuando devuelva el CSV limpio, se cargará automáticamente al dashboard."
            : "Sube un CSV con el historial de tiendas visibles para visualizar el dashboard completo."}
        </p>
      </div>

      <div
        onDragOver={(e) => {
          if (busy) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          if (busy) return;
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handle(f);
        }}
        className={`card-rappi border-2 border-dashed transition-all p-12 text-center ${
          busy ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        } ${drag ? "border-primary bg-accent" : "border-border"}`}
        onClick={() => {
          if (busy) return;
          document.getElementById("csv-input-source")?.click();
        }}
      >
        <input
          id="csv-input-source"
          type="file"
          accept={isDirty ? ".zip,application/zip,application/x-zip-compressed" : ".csv,text/csv"}
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handle(f);
            e.target.value = "";
          }}
        />
        <div
          className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
            isDirty ? "bg-accent" : "bg-primary/10"
          }`}
        >
          {processing ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : isDirty ? (
            <Sparkles className="w-8 h-8 text-primary" />
          ) : (
            <Upload className="w-8 h-8 text-primary" />
          )}
        </div>
        <p className="text-lg font-semibold text-foreground">
          {processing
            ? "Procesando..."
            : drag
              ? "Suelta el archivo aquí"
              : isDirty
                ? "Arrastra tu ZIP aquí"
                : "Arrastra tu CSV aquí"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {processing ? progressMsg : "o haz clic para seleccionarlo"}
        </p>

        <button
          type="button"
          disabled={busy}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-rappi-orange-light disabled:opacity-50"
        >
          {processing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4" />
          )}
          {processing ? "Procesando..." : isDirty ? "Subir ZIP y procesar" : "Cargar CSV"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-8 text-xs text-muted-foreground text-center">
        {isDirty ? (
          <>
            El procesamiento se hace en un servicio externo seguro.
            <br />
            El archivo limpio se carga directo al dashboard sin pasos adicionales.
          </>
        ) : (
          <>
            Columnas esperadas:{" "}
            <code className="font-mono">timestamp, visible_stores, date, hour, day_of_week...</code>
          </>
        )}
      </div>
    </div>
  );
}
