import { useMemo } from "react";
import type { Filters, PeriodPreset } from "@/lib/dashboard-data";
import { Search, RotateCcw, Clock, Calendar } from "lucide-react";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  dateBounds: { min: string; max: string };
};

const PERIODS: { id: PeriodPreset; label: string }[] = [
  { id: "all", label: "Todo" },
  { id: "week", label: "Semana" },
  { id: "today", label: "Hoy" },
];

const ALL_FRANJAS = ["Madrugada", "Mañana", "Tarde", "Noche"];
const ALL_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function FilterBar({ filters, onChange, onReset, dateBounds }: Props) {
  const toggle = (key: "days" | "franjas", v: string) => {
    const cur = filters[key];
    onChange({
      ...filters,
      [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    });
  };

  const active = useMemo(
    () =>
      filters.days.length +
      filters.franjas.length +
      (filters.period !== "all" ? 1 : 0) +
      (filters.dateFrom ? 1 : 0) +
      (filters.dateTo ? 1 : 0) +
      (filters.query ? 1 : 0),
    [filters]
  );

  return (
    <div className="card-rappi p-4 sm:p-5">
      {/* Fila principal: período + franja (lo más importante) */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        {/* Período */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
            <Calendar className="w-3.5 h-3.5" />
            Período
          </div>
          <div className="flex gap-1 bg-muted rounded-full p-1">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => onChange({ ...filters, period: p.id })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  filters.period === p.id
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Franja horaria - destacada como filtro principal */}
        <div className="flex items-center gap-3 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            Franja
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_FRANJAS.map((f) => {
              const on = filters.franjas.includes(f);
              return (
                <button
                  key={f}
                  onClick={() => toggle("franjas", f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:border-primary"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onReset}
          disabled={active === 0}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-40 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Resetear {active > 0 && `(${active})`}
        </button>
      </div>

      {/* Fila secundaria: día semana + fechas + búsqueda */}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground hover:text-foreground transition list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform">▸</span>
          Filtros avanzados
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Día de la semana
            </label>
            <div className="flex flex-wrap gap-1 mt-2">
              {ALL_DAYS.map((d) => {
                const on = filters.days.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() => toggle("days", d)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary"
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Rango personalizado
            </label>
            <div className="flex gap-2 mt-2">
              <input
                type="date"
                min={dateBounds.min}
                max={dateBounds.max}
                value={filters.dateFrom ?? ""}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
                className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary"
              />
              <input
                type="date"
                min={dateBounds.min}
                max={dateBounds.max}
                value={filters.dateTo ?? ""}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
                className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Buscar
            </label>
            <div className="relative mt-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ej: 2026-02-15"
                value={filters.query}
                onChange={(e) => onChange({ ...filters, query: e.target.value })}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
