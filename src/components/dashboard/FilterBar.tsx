import { useMemo } from "react";
import type { Filters } from "@/lib/dashboard-data";
import { Search, RotateCcw } from "lucide-react";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  dateBounds: { min: string; max: string };
};

const ALL_DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const ALL_FRANJAS = ["Madrugada", "Mañana", "Tarde", "Noche"];

function MultiChips({
  options,
  value,
  onToggle,
  label,
}: {
  options: string[];
  value: string[];
  onToggle: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {options.map((o) => {
          const active = value.includes(o);
          return (
            <button
              key={o}
              onClick={() => onToggle(o)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary"
              }`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
      (filters.dateFrom ? 1 : 0) +
      (filters.dateTo ? 1 : 0) +
      (filters.query ? 1 : 0),
    [filters]
  );

  return (
    <div className="card-rappi p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-foreground">Filtros</h3>
        <button
          onClick={onReset}
          disabled={active === 0}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary disabled:opacity-40 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Resetear {active > 0 && `(${active})`}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Rango de fechas
          </label>
          <div className="flex gap-2 mt-2">
            <input
              type="date"
              min={dateBounds.min}
              max={dateBounds.max}
              value={filters.dateFrom ?? ""}
              onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:border-primary"
            />
            <input
              type="date"
              min={dateBounds.min}
              max={dateBounds.max}
              value={filters.dateTo ?? ""}
              onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <MultiChips
          label="Día de la semana"
          options={ALL_DAYS}
          value={filters.days}
          onToggle={(v) => toggle("days", v)}
        />

        <MultiChips
          label="Franja horaria"
          options={ALL_FRANJAS}
          value={filters.franjas}
          onToggle={(v) => toggle("franjas", v)}
        />

        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Buscar (fecha / día / hora)
          </label>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Ej: 2026-02-15"
              value={filters.query}
              onChange={(e) => onChange({ ...filters, query: e.target.value })}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
