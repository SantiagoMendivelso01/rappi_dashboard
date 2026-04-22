import { useCallback, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  FileCheck2,
  Loader2,
  AlertCircle,
  ArrowRight,
  Zap,
  ShieldCheck,
  Wand2,
  Database,
} from "lucide-react";

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
      <div className="relative mx-auto max-w-6xl px-6 py-16 overflow-hidden">
        {/* Decorative background orbs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--rappi-orange-light) 0%, transparent 70%)" }}
        />

        <div className="relative text-center mb-12 animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-4 py-1.5 text-xs font-semibold text-muted-foreground mb-5 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Comencemos a explorar tus datos
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
            ¿Cómo están tus <span className="shimmer-text">datos</span>?
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto text-base">
            Elige el flujo según el estado de tu archivo. Te llevamos al dashboard en segundos.
          </p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 stagger">
          {/* CLEAN */}
          <button
            onClick={() => setMode("clean")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-primary/40"
            style={{ boxShadow: "0 4px 20px -8px oklch(0.2 0.02 30 / 0.12)" }}
          >
            <div
              aria-hidden
              className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
              style={{ background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)" }}
            />

            <div className="relative flex items-start justify-between mb-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-110 group-hover:rotate-3"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--rappi-orange-light))" }}
              >
                <FileCheck2 className="w-8 h-8 text-primary-foreground" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
                <Zap className="w-3 h-3" /> Rápido
              </span>
            </div>

            <h3 className="relative text-2xl font-extrabold text-foreground mb-2 tracking-tight">
              Datos limpios
            </h3>
            <p className="relative text-sm text-muted-foreground mb-5 leading-relaxed">
              Ya tengo el CSV con las columnas{" "}
              <code className="font-mono text-[11px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded">
                timestamp, visible_stores, date, hour...
              </code>{" "}
              listo para visualizar.
            </p>

            <div className="relative flex items-center gap-2 text-sm text-muted-foreground mb-5">
              <ShieldCheck className="w-4 h-4 text-success" />
              <span>Carga directa, sin procesamiento adicional</span>
            </div>

            <span className="relative inline-flex items-center gap-2 text-sm font-bold text-primary group-hover:gap-3 transition-all">
              Subir directo al dashboard
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          {/* DIRTY */}
          <button
            onClick={() => setMode("dirty")}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-left transition-all hover:-translate-y-1 hover:shadow-2xl hover:border-primary/40"
            style={{ boxShadow: "0 4px 20px -8px oklch(0.2 0.02 30 / 0.12)" }}
          >
            <div
              aria-hidden
              className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
              style={{ background: "radial-gradient(circle, var(--rappi-orange-light) 0%, transparent 70%)" }}
            />

            <div className="relative flex items-start justify-between mb-5">
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-110 group-hover:-rotate-3"
                style={{ background: "linear-gradient(135deg, oklch(0.197 0.029 280), oklch(0.35 0.05 280))" }}
              >
                <Wand2 className="w-8 h-8 text-primary-foreground" />
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">
                <Sparkles className="w-3 h-3" /> Auto
              </span>
            </div>

            <h3 className="relative text-2xl font-extrabold text-foreground mb-2 tracking-tight">
              Datos sucios
            </h3>
            <p className="relative text-sm text-muted-foreground mb-5 leading-relaxed">
              Tengo el ZIP crudo. Lo enviaré al servicio de procesamiento para que lo limpie y cargue
              el CSV resultante al dashboard automáticamente.
            </p>

            <div className="relative flex items-center gap-2 text-sm text-muted-foreground mb-5">
              <Database className="w-4 h-4 text-primary" />
              <span>Procesamiento automático en la nube</span>
            </div>

            <span className="relative inline-flex items-center gap-2 text-sm font-bold text-primary group-hover:gap-3 transition-all">
              Procesar y cargar
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </div>

        {/* Footer hint */}
        <div className="relative mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground animate-fade-in-soft">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Servicio activo
          </div>
          <div className="w-px h-3 bg-border" />
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Procesamiento seguro
          </div>
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
