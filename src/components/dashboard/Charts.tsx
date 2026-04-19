import { useMemo } from "react";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  Title,
} from "chart.js";
import type { DailyAgg } from "@/lib/dashboard-data";
import { fmtNum, fmtPct, franja, type Row } from "@/lib/csv";

ChartJS.register(
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  Title
);

const RAPPI = "#FF441A";
const RAPPI_FILL = "rgba(255,68,26,0.12)";

const baseOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#1A1A2E",
      padding: 10,
      titleFont: { family: "Inter", weight: 600 as const },
      bodyFont: { family: "Inter" },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { font: { family: "Inter", size: 11 } } },
    y: { grid: { color: "#F1F1F3" }, ticks: { font: { family: "Inter", size: 11 } } },
  },
};

export function TrendChart({ daily }: { daily: DailyAgg[] }) {
  const data = {
    labels: daily.map((d) => d.date.slice(5)),
    datasets: [
      {
        label: "Disponibilidad %",
        data: daily.map((d) => Number(d.availability.toFixed(2))),
        borderColor: RAPPI,
        backgroundColor: RAPPI_FILL,
        fill: true,
        tension: 0.35,
        pointRadius: 2,
        pointHoverRadius: 5,
        borderWidth: 2.5,
      },
    ],
  };
  return (
    <div className="card-rappi p-5">
      <h3 className="font-bold text-foreground">Tendencia diaria de disponibilidad</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Promedio diario respecto al pico histórico (% disponibilidad).
      </p>
      <div className="h-72">
        <Line
          data={data}
          options={{
            ...baseOpts,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                ...baseOpts.plugins.tooltip,
                callbacks: { label: (ctx) => `${fmtPct(Number(ctx.parsed.y ?? 0))}` },
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export function WorstMomentsChart({ rows }: { rows: Row[] }) {
  const top = useMemo(() => {
    return [...rows]
      .filter((r) => r.visibleStores > 0)
      .sort((a, b) => a.visibleStores - b.visibleStores)
      .slice(0, 10)
      .reverse();
  }, [rows]);

  const max = top.length ? Math.max(...top.map((t) => t.visibleStores)) : 1;
  const colors = top.map((t) => {
    const ratio = t.visibleStores / max;
    if (ratio < 0.4) return "#EF4444";
    if (ratio < 0.7) return "#F59E0B";
    return "#FF6B35";
  });

  const data = {
    labels: top.map((t) => `${t.date.slice(5)} ${String(t.hour).padStart(2, "0")}:${String(t.minute).padStart(2, "0")}`),
    datasets: [
      {
        label: "Tiendas visibles",
        data: top.map((t) => t.visibleStores),
        backgroundColor: colors,
        borderRadius: 6,
      },
    ],
  };

  return (
    <div className="card-rappi p-5">
      <h3 className="font-bold text-foreground">Top 10 momentos con MENOR disponibilidad</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Instantes con menos tiendas visibles (degradado amarillo → rojo).
      </p>
      <div className="h-72">
        <Bar
          data={data}
          options={{
            ...baseOpts,
            indexAxis: "y" as const,
            plugins: {
              ...baseOpts.plugins,
              tooltip: {
                ...baseOpts.plugins.tooltip,
                callbacks: { label: (ctx) => `${fmtNum(Number(ctx.parsed.x))} tiendas` },
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export function FranjaChart({ rows, peak }: { rows: Row[]; peak: number }) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const dayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const franjas = ["Madrugada", "Mañana", "Tarde", "Noche"];
  const colors: Record<string, string> = {
    Madrugada: "#1A1A2E",
    Mañana: "#FF6B35",
    Tarde: "#FF441A",
    Noche: "#6B7280",
  };

  const sums: Record<string, number[]> = Object.fromEntries(franjas.map((f) => [f, Array(7).fill(0)]));
  const counts: Record<string, number[]> = Object.fromEntries(
    franjas.map((f) => [f, Array(7).fill(0)])
  );

  for (const r of rows) {
    const di = days.indexOf(r.dayOfWeek);
    if (di < 0) continue;
    const f = franja(r.hour);
    sums[f][di] += r.visibleStores;
    counts[f][di] += 1;
  }

  const datasets = franjas.map((f) => ({
    label: f,
    data: sums[f].map((s, i) => {
      const c = counts[f][i];
      if (!c) return 0;
      return Number((((s / c) / peak) * 100).toFixed(2));
    }),
    backgroundColor: colors[f],
    borderRadius: 4,
  }));

  return (
    <div className="card-rappi p-5">
      <h3 className="font-bold text-foreground">Disponibilidad por franja y día</h3>
      <p className="text-xs text-muted-foreground mb-3">% promedio según día de la semana y franja horaria.</p>
      <div className="h-72">
        <Bar
          data={{ labels: dayLabels, datasets }}
          options={{
            ...baseOpts,
            plugins: {
              ...baseOpts.plugins,
              legend: {
                display: true,
                position: "bottom" as const,
                labels: { font: { family: "Inter", size: 11 }, boxWidth: 12, boxHeight: 12 },
              },
              tooltip: {
                ...baseOpts.plugins.tooltip,
                callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtPct(Number(ctx.parsed.y ?? 0))}` },
              },
            },
            scales: {
              x: { ...baseOpts.scales.x, stacked: false },
              y: {
                ...baseOpts.scales.y,
                ticks: { ...baseOpts.scales.y.ticks, callback: (v) => `${v}%` },
              },
            },
          }}
        />
      </div>
    </div>
  );
}
