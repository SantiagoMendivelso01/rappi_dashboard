import { useMemo, useState } from "react";
import { ArrowUpDown, Download, Search } from "lucide-react";
import { availabilityClass, type DailyAgg } from "@/lib/dashboard-data";
import { dayEs, downloadCSV, fmtNum, fmtPct } from "@/lib/csv";

type SortKey = keyof DailyAgg;

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "date", label: "Fecha" },
  { key: "dayOfWeek", label: "Día" },
  { key: "avg", label: "Tiendas (prom)", align: "right" },
  { key: "min", label: "Mín", align: "right" },
  { key: "max", label: "Máx", align: "right" },
  { key: "availability", label: "Disponibilidad", align: "right" },
  { key: "orders", label: "Órdenes est.", align: "right" },
  { key: "incidents", label: "Incidentes", align: "right" },
];

const PAGE_SIZE = 15;

const badge = {
  ok: "bg-[oklch(0.72_0.18_145_/_0.15)] text-[oklch(0.45_0.17_145)]",
  warn: "bg-[oklch(0.78_0.16_70_/_0.18)] text-[oklch(0.5_0.16_70)]",
  bad: "bg-destructive/15 text-destructive",
};

export function DataTable({ daily }: { daily: DailyAgg[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "date",
    dir: "asc",
  });
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return daily.filter(
      (d) =>
        !ql ||
        d.date.includes(ql) ||
        dayEs(d.dayOfWeek).toLowerCase().includes(ql)
    );
  }, [daily, q]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number")
        return sort.dir === "asc" ? av - bv : bv - av;
      return sort.dir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const onSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const exportCSV = () => {
    const header = ["Fecha", "Día", "Tiendas Prom", "Mín", "Máx", "Disponibilidad %", "Órdenes Est", "Incidentes"];
    const rows = sorted.map((d) => [
      d.date,
      dayEs(d.dayOfWeek),
      d.avg.toFixed(1),
      d.min,
      d.max,
      d.availability.toFixed(2),
      d.orders,
      d.incidents,
    ]);
    downloadCSV(`rappi-dashboard-${new Date().toISOString().slice(0, 10)}.csv`, [header, ...rows]);
  };

  return (
    <div className="card-rappi p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground">Detalle diario</h3>
          <p className="text-xs text-muted-foreground">
            {fmtNum(filtered.length)} días · ordena por encabezados
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar en la tabla..."
              className="pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-rappi-orange-light transition"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => onSort(c.key)}
                  className={`py-2.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground cursor-pointer select-none hover:text-primary ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <ArrowUpDown className="w-3 h-3 opacity-50" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((d) => {
              const cls = availabilityClass(d.availability);
              return (
                <tr key={d.date} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="py-2.5 px-3 font-medium">{d.date}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{dayEs(d.dayOfWeek)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{fmtNum(Math.round(d.avg))}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {fmtNum(d.min)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {fmtNum(d.max)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${badge[cls]}`}>
                      {fmtPct(d.availability)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">{fmtNum(d.orders)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{fmtNum(d.incidents)}</td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-8 text-center text-muted-foreground">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>
          Página {page + 1} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-border bg-card disabled:opacity-40 hover:border-primary"
          >
            Anterior
          </button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-border bg-card disabled:opacity-40 hover:border-primary"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
