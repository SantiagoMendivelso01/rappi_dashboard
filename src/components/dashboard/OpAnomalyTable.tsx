import { useState, useMemo } from "react";
import type { OpAnomaly } from "@/lib/dashboard-data";
import { fmtNum } from "@/lib/csv";
import { AlertOctagon, AlertTriangle, ShieldCheck } from "lucide-react";

const SEV_CONFIG = {
  critical: {
    label: "Critical",
    icon: AlertOctagon,
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badge:
      "bg-[oklch(0.78_0.16_70_/_0.15)] text-[oklch(0.55_0.16_70)] border-[oklch(0.78_0.16_70_/_0.4)]",
    dot: "bg-[oklch(0.7_0.18_70)]",
  },
} as const;

const PAGE_SIZE = 12;

export function OpAnomalyTable({ anomalies }: { anomalies: OpAnomaly[] }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "critical" | "warning">("all");

  const counts = useMemo(
    () => ({
      critical: anomalies.filter((a) => a.severity === "critical").length,
      warning: anomalies.filter((a) => a.severity === "warning").length,
    }),
    [anomalies]
  );

  // Ordenar por mayor caída (más negativo primero)
  const sorted = useMemo(
    () => [...anomalies].sort((a, b) => a.dropPct - b.dropPct),
    [anomalies]
  );
  const filtered =
    filter === "all" ? sorted : sorted.filter((a) => a.severity === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="card-rappi p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-destructive" />
            Anomalías operacionales (10h–21h)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Caídas {">"} 12% vs. 60s atrás dentro de la ventana operacional.
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <FilterBtn active={filter === "all"} onClick={() => { setFilter("all"); setPage(0); }}>
            Todas ({anomalies.length})
          </FilterBtn>
          <FilterBtn
            active={filter === "critical"}
            onClick={() => { setFilter("critical"); setPage(0); }}
            sev="critical"
          >
            Critical ({counts.critical})
          </FilterBtn>
          <FilterBtn
            active={filter === "warning"}
            onClick={() => { setFilter("warning"); setPage(0); }}
            sev="warning"
          >
            Warning ({counts.warning})
          </FilterBtn>
        </div>
      </div>

      {paginated.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground flex flex-col items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-[oklch(0.65_0.18_145)]" />
          {anomalies.length === 0
            ? "Sin anomalías en la ventana operacional."
            : "No hay anomalías en esta categoría."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4 font-semibold">Severidad</th>
                <th className="pb-2 pr-4 font-semibold">Fecha</th>
                <th className="pb-2 pr-4 font-semibold">Hora</th>
                <th className="pb-2 pr-4 font-semibold text-right">Tiendas visibles</th>
                <th className="pb-2 pr-4 font-semibold text-right">Hace 60s</th>
                <th className="pb-2 font-semibold text-right">Caída %</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a, i) => {
                const cfg = SEV_CONFIG[a.severity];
                const Icon = cfg.icon;
                const hh = String(a.hour).padStart(2, "0");
                const mm = String(a.minute).padStart(2, "0");
                const ss = String(a.second).padStart(2, "0");
                return (
                  <tr
                    key={i}
                    className="border-b border-border last:border-0 hover:bg-muted/40 transition"
                  >
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${cfg.badge}`}
                      >
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{a.date}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{`${hh}:${mm}:${ss}`}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">
                      {fmtNum(a.value, 0)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground tabular-nums">
                      {fmtNum(a.prevValue, 0)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-bold text-destructive">
                      {a.dropPct.toFixed(2)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg border border-border hover:border-primary disabled:opacity-40 transition"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg border border-border hover:border-primary disabled:opacity-40 transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
  sev,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  sev?: "critical" | "warning";
}) {
  const dot = sev ? SEV_CONFIG[sev].dot : "bg-primary";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-muted-foreground border-border hover:border-primary"
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {children}
    </button>
  );
}
