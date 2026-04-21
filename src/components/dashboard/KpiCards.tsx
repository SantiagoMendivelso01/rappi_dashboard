import type { GlobalStats } from "@/lib/dashboard-data";
import { fmtNum } from "@/lib/csv";
import { TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle, AlertTriangle } from "lucide-react";

type Props = {
  stats: GlobalStats;
  opAnomaliesCount?: number;
  opCriticalCount?: number;
};

const fmtTimestamp = (d: Date | null) => {
  if (!d) return "—";
  const date = d.toISOString().slice(0, 10);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
};

export function KpiCards({ stats, opAnomaliesCount, opCriticalCount = 0 }: Props) {
  const opCount = opAnomaniesCountSafe(opAnomaliesCount, stats.anomaliesCount);
  const trendUp = stats.trend7d >= 0;
  const trendClass = trendUp ? "text-[oklch(0.55_0.17_145)]" : "text-destructive";
  const trendBg = trendUp
    ? "bg-[oklch(0.72_0.18_145_/_0.12)] text-[oklch(0.55_0.17_145)]"
    : "bg-destructive/10 text-destructive";

  const cards = [
    {
      label: "Promedio global",
      value: fmtNum(stats.avg, 0),
      sub: "tiendas visibles",
      icon: TrendingUp,
      accent: "text-primary",
      badge: "Promedio del rango filtrado",
      badgeClass: "bg-primary/10 text-primary",
    },
    {
      label: "Máximo histórico",
      value: fmtNum(stats.max, 0),
      sub: fmtTimestamp(stats.maxAt),
      icon: ArrowUpCircle,
      accent: "text-[oklch(0.55_0.17_145)]",
      badge: "Pico observado",
      badgeClass: "bg-[oklch(0.72_0.18_145_/_0.12)] text-[oklch(0.55_0.17_145)]",
    },
    {
      label: "Mínimo histórico",
      value: fmtNum(stats.min, 0),
      sub: fmtTimestamp(stats.minAt),
      icon: ArrowDownCircle,
      accent: "text-destructive",
      badge: "Caída más profunda",
      badgeClass: "bg-destructive/10 text-destructive",
    },
    {
      label: "Tendencia 7 días",
      value: `${trendUp ? "+" : ""}${stats.trend7d.toFixed(1)}%`,
      sub: "vs. 7 días previos",
      icon: trendUp ? TrendingUp : TrendingDown,
      accent: trendClass,
      badge: trendUp ? "Mejorando" : "Empeorando",
      badgeClass: trendBg,
    },
    {
      label: "Anomalías detectadas",
      value: fmtNum(stats.anomaliesCount, 0),
      sub: "Δ ±1% en 1 min · ±2σ rolling",
      icon: AlertTriangle,
      accent: stats.anomaliesCount > 0 ? "text-[oklch(0.58_0.16_70)]" : "text-foreground",
      badge: stats.anomaliesCount > 0 ? "Revisar tabla" : "Sin alertas",
      badgeClass:
        stats.anomaliesCount > 0
          ? "bg-[oklch(0.78_0.16_70_/_0.15)] text-[oklch(0.58_0.16_70)]"
          : "bg-muted text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 stagger">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="card-rappi p-5"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground font-medium">{c.label}</p>
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center transition-transform duration-300 hover:scale-110 hover:rotate-3">
              <c.icon className={`w-5 h-5 ${c.accent}`} />
            </div>
          </div>
          <p className={`metric-num text-3xl xl:text-4xl mt-3 ${c.accent}`}>{c.value}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate" title={c.sub}>
            {c.sub}
          </p>
          <span
            className={`inline-block mt-3 text-xs px-2.5 py-1 rounded-full font-medium ${c.badgeClass}`}
          >
            {c.badge}
          </span>
        </div>
      ))}
    </div>
  );
}
