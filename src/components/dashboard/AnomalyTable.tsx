import { useState } from "react";
import type { Anomaly } from "@/lib/dashboard-data";
import { fmtNum } from "@/lib/csv";
import { AlertOctagon, AlertTriangle, TrendingUp } from "lucide-react";

const SEV_CONFIG = {
  critical: {
    label: "Crítica",
    icon: AlertOctagon,
    badge: "bg-destructive/10 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  moderate: {
    label: "Moderada",
    icon: AlertTriangle,
    badge:
      "bg-[oklch(0.78_0.16_70_/_0.15)] text-[oklch(0.55_0.16_70)] border-[oklch(0.78_0.16_70_/_0.4)]",
    dot: "bg-[oklch(0.7_0.18_70)]",
  },
  recovery: {
    label: "Recuperación",
    icon: TrendingUp,
    badge:
      "bg-[oklch(0.72_0.18_145_/_0.12)] text-[oklch(0.45_0.17_145)] border-[oklch(0.72_0.18_145_/_0.4)]",
    dot: "bg-[oklch(0.65_0.18_145)]",
  },
} as const;

const PAGE_SIZE = 12;

export function AnomalyTable({ anomalies }: { anomalies: Anomaly[] }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | Anomaly["severity"]>("all");

  const filtered = filter === "all" ? anomalies : anomalies.filter((a) => a.severity === filter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const counts = {
    critical: anomalies.filter((a) => a.severity === "critical").length,
    moderate: anomalies.filter((a) => a.severity === "moderate").length,
    recovery: anomalies.filter((a) => a.severity === "recovery").length,
  };

  return (
    <div className="card-rappi p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground">Tabla de anomalías</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {anomalies.length === 0
              ? "Sin anomalías detectadas en este rango."
              : `${anomalies.length} eventos: caídas/subidas >±1% en 1 min y outliers ±2σ (rolling 5 min).`}
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
            Críticas ({counts.critical})
          </FilterBtn>
          <FilterBtn
            active={filter === "moderate"}
            onClick={() => { setFilter("moderate"); setPage(0); }}
            sev="moderate"
          >
            Moderadas ({counts.moderate})
          </FilterBtn>
          <FilterBtn
            active={filter === "recovery"}
            onClick={() => { setFilter("recovery"); setPage(0); }}
            sev="recovery"
          >
            Recuperaciones ({counts.recovery})
          </FilterBtn>
        </div>
      </div>

      {paginated.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No hay anomalías en esta categoría.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 pr-4 font-semibold">Severidad</th>
                <th className="pb-2 pr-4 font-semibold">Tipo</th>
                <th className="pb-2 pr-4 font-semibold">Timestamp</th>
                <th className="pb-2 pr-4 font-semibold text-right">Valor</th>
                <th className="pb-2 pr-4 font-semibold text-right">Esperado</th>
                <th className="pb-2 pr-4 font-semibold text-right">Δ</th>
                <th className="pb-2 font-semibold text-right">Δ % (1 min)</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((a, i) => {
                const cfg = SEV_CONFIG[a.severity];
                const Icon = cfg.icon;
                const ts = a.timestamp;
                const tsStr = `${a.date} ${String(ts.getHours()).padStart(2, "0")}:${String(
                  ts.getMinutes()
                ).padStart(2, "0")}:${String(ts.getSeconds()).padStart(2, "0")}`;
                const kindLabel =
                  a.kind === "drop" ? "Caída" : a.kind === "spike" ? "Subida" : "Outlier ±2σ";
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
                    <td className="py-2.5 pr-4 text-xs text-muted-foreground font-medium">
                      {kindLabel}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{tsStr}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">
                      {fmtNum(a.value)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground tabular-nums">
                      {fmtNum(a.expected, 0)}
                    </td>
                    <td
                      className={`py-2.5 pr-4 text-right tabular-nums font-medium ${
                        a.delta < 0 ? "text-destructive" : "text-[oklch(0.55_0.17_145)]"
                      }`}
                    >
                      {a.delta > 0 ? "+" : ""}
                      {fmtNum(a.delta, 0)}
                    </td>
                    <td
                      className={`py-2.5 text-right tabular-nums font-semibold ${
                        a.deltaPct < 0 ? "text-destructive" : "text-[oklch(0.55_0.17_145)]"
                      }`}
                    >
                      {a.deltaPct > 0 ? "+" : ""}
                      {a.deltaPct.toFixed(2)}%
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
  sev?: Anomaly["severity"];
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
