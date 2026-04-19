import { availabilityClass, type DailyAgg } from "@/lib/dashboard-data";
import { fmtNum, fmtPct } from "@/lib/csv";
import { Store, TrendingUp, AlertTriangle, CalendarRange } from "lucide-react";

type Props = {
  daily: DailyAgg[];
  totalStores: number;
  dateMin: string;
  dateMax: string;
};

const cls = {
  ok: "text-[oklch(var(--success)_/_1)]",
  warn: "text-[oklch(var(--warning)_/_1)]",
  bad: "text-destructive",
} as const;

const bgCls = {
  ok: "bg-[oklch(0.72_0.18_145_/_0.12)] text-[oklch(0.55_0.17_145)]",
  warn: "bg-[oklch(0.78_0.16_70_/_0.15)] text-[oklch(0.58_0.16_70)]",
  bad: "bg-destructive/10 text-destructive",
} as const;

export function KpiCards({ daily, totalStores, dateMin, dateMax }: Props) {
  const avgAvail =
    daily.length > 0 ? daily.reduce((s, d) => s + d.availability, 0) / daily.length : 0;
  const critical = daily.filter((d) => d.availability < 70).length;
  const availClass = availabilityClass(avgAvail);

  const cards = [
    {
      label: "Disponibilidad promedio",
      value: fmtPct(avgAvail),
      icon: TrendingUp,
      accentClass: cls[availClass],
      badgeClass: bgCls[availClass],
      badge: availClass === "ok" ? "Óptima" : availClass === "warn" ? "Aceptable" : "Crítica",
    },
    {
      label: "Pico máximo de tiendas",
      value: fmtNum(totalStores),
      icon: Store,
      accentClass: "text-primary",
      badgeClass: "bg-primary/10 text-primary",
      badge: "Tiendas únicas vistas",
    },
    {
      label: "Días en estado crítico",
      value: fmtNum(critical),
      icon: AlertTriangle,
      accentClass: critical > 0 ? "text-destructive" : "text-foreground",
      badgeClass: critical > 0 ? bgCls.bad : "bg-muted text-muted-foreground",
      badge: critical > 0 ? "Requiere atención" : "Todo bien",
    },
    {
      label: "Período analizado",
      value: `${daily.length} días`,
      icon: CalendarRange,
      accentClass: "text-foreground",
      badgeClass: "bg-muted text-muted-foreground",
      badge: dateMin && dateMax ? `${dateMin} → ${dateMax}` : "—",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="card-rappi p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground font-medium">{c.label}</p>
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <c.icon className={`w-5 h-5 ${c.accentClass}`} />
            </div>
          </div>
          <p className={`metric-num text-4xl mt-3 ${c.accentClass}`}>{c.value}</p>
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
