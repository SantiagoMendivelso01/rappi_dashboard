import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TopBar } from "@/components/dashboard/TopBar";
import { FileDropzone } from "@/components/dashboard/FileDropzone";
import { Skeleton } from "@/components/dashboard/Skeleton";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { HourlyAvgChart } from "@/components/dashboard/HourlyAvgChart";
import { AnomalyTable } from "@/components/dashboard/AnomalyTable";
import { Heatmap } from "@/components/dashboard/Heatmap";
import { DataTable } from "@/components/dashboard/DataTable";
import { ReportButton } from "@/components/dashboard/ReportButton";
import { ChatBot } from "@/components/dashboard/ChatBot";
import { parseCSV, type Row } from "@/lib/csv";
import {
  aggregateByDay,
  applyFilters,
  computeGlobalStats,
  detectAnomalies,
  emptyFilters,
  type Filters,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Rappi · Store Availability Dashboard" },
      {
        name: "description",
        content:
          "Dashboard interactivo de disponibilidad histórica de tiendas en Rappi. Carga tu CSV y visualiza tendencias, alertas y mapas de calor.",
      },
    ],
  }),
});

function Index() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const handleFile = (text: string, name: string) => {
    setLoading(true);
    setError(null);
    // simular skeleton 1 frame para feedback
    setTimeout(() => {
      try {
        const parsed = parseCSV(text);
        setRows(parsed);
        setFileName(name);
        setFilters(emptyFilters);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al procesar el archivo");
        setRows(null);
      } finally {
        setLoading(false);
      }
    }, 50);
  };

  const dateBounds = useMemo(() => {
    if (!rows || rows.length === 0) return { min: "", max: "" };
    return { min: rows[0].date, max: rows[rows.length - 1].date };
  }, [rows]);

  const peakGlobal = useMemo(() => {
    if (!rows) return 0;
    return rows.reduce((m, r) => (r.visibleStores > m ? r.visibleStores : m), 0);
  }, [rows]);

  const filtered = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters]);
  const daily = useMemo(() => aggregateByDay(filtered, peakGlobal), [filtered, peakGlobal]);
  const anomalies = useMemo(() => detectAnomalies(filtered), [filtered]);
  const stats = useMemo(() => computeGlobalStats(filtered, anomalies), [filtered, anomalies]);

  return (
    <div className="min-h-screen bg-background">
      <TopBar
        fileName={rows ? fileName : undefined}
        onReset={() => {
          setRows(null);
          setFileName("");
        }}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {!rows && !loading && <FileDropzone onFile={handleFile} loading={loading} />}

        {error && !loading && (
          <div className="max-w-3xl mx-auto mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-semibold mb-1">No pudimos procesar el archivo</p>
            <p>{error}</p>
          </div>
        )}

        {loading && (
          <div className="mt-4">
            <Skeleton />
          </div>
        )}

        {rows && !loading && (
          <div className="space-y-5">
            <div className="flex flex-col xl:flex-row xl:items-start gap-3">
              <div className="flex-1 min-w-0">
                <FilterBar
                  filters={filters}
                  onChange={setFilters}
                  onReset={() => setFilters(emptyFilters)}
                  dateBounds={dateBounds}
                />
              </div>
              <ReportButton
                rows={rows}
                filteredRows={filtered}
                filters={filters}
                fileName={fileName}
              />
            </div>

            <KpiCards stats={stats} />

            <TimeSeriesChart rows={filtered} anomalies={anomalies} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <HourlyAvgChart rows={filtered} />
              <Heatmap rows={filtered} peak={peakGlobal} />
            </div>

            <AnomalyTable anomalies={anomalies} />

            <DataTable daily={daily} />

            <p className="text-center text-xs text-muted-foreground py-6">
              Procesado 100% en tu navegador · Sin envío de datos
            </p>
          </div>
        )}
      </main>

      {rows && !loading && <ChatBot rows={rows} fileName={fileName} />}
    </div>
  );
}
