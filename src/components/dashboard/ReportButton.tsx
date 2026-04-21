import { useMemo, useState } from "react";
import { FileDown, Loader2, FileText, Calendar, CalendarRange, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Row } from "@/lib/csv";
import { dayEs } from "@/lib/csv";
import { applyFilters, type Filters } from "@/lib/dashboard-data";
import { generateReportPDF, type ReportScope } from "@/lib/report-pdf";

type Mode = "all" | "day" | "range" | "current";

type Props = {
  rows: Row[];
  filteredRows: Row[];
  filters: Filters;
  fileName?: string;
};

export function ReportButton({ rows, filteredRows, filters, fileName }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("all");
  const [day, setDay] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const availableDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.date);
    return Array.from(set).sort();
  }, [rows]);

  const bounds = useMemo(() => {
    if (rows.length === 0) return { min: "", max: "" };
    return { min: rows[0].date, max: rows[rows.length - 1].date };
  }, [rows]);

  const filtersActive =
    filters.period !== "all" ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.days.length > 0 ||
    filters.franjas.length > 0 ||
    filters.query.length > 0;

  const handleGenerate = async () => {
    setBusy(true);
    try {
      let scopeRows: Row[] = [];
      let scope: ReportScope;

      if (mode === "all") {
        scopeRows = rows;
        scope = { kind: "all", label: `Informe completo · ${rows.length.toLocaleString("es-ES")} registros` };
      } else if (mode === "current") {
        scopeRows = filteredRows;
        const parts: string[] = [];
        if (filters.period !== "all") parts.push(filters.period === "today" ? "Hoy" : "Última semana");
        if (filters.dateFrom || filters.dateTo) parts.push(`${filters.dateFrom ?? "…"} → ${filters.dateTo ?? "…"}`);
        if (filters.days.length) parts.push(filters.days.join(", "));
        if (filters.franjas.length) parts.push(filters.franjas.join(", "));
        if (filters.query) parts.push(`"${filters.query}"`);
        scope = {
          kind: "all",
          label: `Filtros aplicados · ${parts.join(" · ") || "sin filtros"}`,
        };
      } else if (mode === "day") {
        if (!day) return;
        scopeRows = applyFilters(rows, {
          ...filters,
          period: "all",
          dateFrom: day,
          dateTo: day,
          days: [],
          franjas: [],
          query: "",
        });
        const sample = rows.find((r) => r.date === day);
        const dayLabel = sample ? dayEs(sample.dayOfWeek) : "";
        scope = { kind: "day", date: day, label: `Día ${day}${dayLabel ? ` · ${dayLabel}` : ""}` };
      } else {
        if (!from || !to) return;
        const lo = from <= to ? from : to;
        const hi = from <= to ? to : from;
        scopeRows = applyFilters(rows, {
          ...filters,
          period: "all",
          dateFrom: lo,
          dateTo: hi,
          days: [],
          franjas: [],
          query: "",
        });
        scope = { kind: "range", from: lo, to: hi, label: `Rango ${lo} → ${hi}` };
      }

      generateReportPDF({ rows: scopeRows, scope, fileName });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const canGenerate =
    (mode === "all" && rows.length > 0) ||
    (mode === "current" && filteredRows.length > 0) ||
    (mode === "day" && !!day) ||
    (mode === "range" && !!from && !!to);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <FileDown className="w-4 h-4" />
          Generar informe
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Generar informe PDF</DialogTitle>
          <DialogDescription>
            Elige el alcance del informe. Se descargará un PDF con KPIs, promedio horario, detalle diario y anomalías.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <ScopeOption
            active={mode === "all"}
            onClick={() => setMode("all")}
            icon={<FileText className="w-4 h-4" />}
            title="Informe completo"
            desc={`Todos los datos cargados (${rows.length.toLocaleString("es-ES")} registros)`}
          />
          <ScopeOption
            active={mode === "current"}
            onClick={() => setMode("current")}
            icon={<Filter className="w-4 h-4" />}
            title="Selección actual"
            desc={
              filtersActive
                ? `Aplica los filtros activos del dashboard (${filteredRows.length.toLocaleString("es-ES")} registros)`
                : "No hay filtros activos · equivale al informe completo"
            }
          />
          <ScopeOption
            active={mode === "day"}
            onClick={() => setMode("day")}
            icon={<Calendar className="w-4 h-4" />}
            title="Día específico"
            desc="Informe enfocado en una sola fecha"
          >
            {mode === "day" && (
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecciona una fecha…</option>
                {availableDays.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </ScopeOption>
          <ScopeOption
            active={mode === "range"}
            onClick={() => setMode("range")}
            icon={<CalendarRange className="w-4 h-4" />}
            title="Rango personalizado"
            desc="Define fecha de inicio y fin"
          >
            {mode === "range" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={from}
                  min={bounds.min}
                  max={bounds.max}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={to}
                  min={bounds.min}
                  max={bounds.max}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </ScopeOption>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || busy} className="gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {busy ? "Generando…" : "Descargar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeOption({
  active,
  onClick,
  icon,
  title,
  desc,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 transition ${
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          {children}
        </div>
        <div
          className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 ${
            active ? "border-primary bg-primary" : "border-border"
          }`}
        />
      </div>
    </button>
  );
}
