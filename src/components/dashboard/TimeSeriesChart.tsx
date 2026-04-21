import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
} from "recharts";
import type { Row } from "@/lib/csv";
import { fmtNum } from "@/lib/csv";
import { lttb, type Anomaly } from "@/lib/dashboard-data";
import { Activity } from "lucide-react";

type Zoom = "1h" | "1d" | "full";

type Point = {
  ts: number;
  label: string;
  value: number;
  drop: number | null;
  spike: number | null;
  outlier: number | null;
};

const MAX_POINTS = 600; // downsampling target

export function TimeSeriesChart({ rows, anomalies }: { rows: Row[]; anomalies: Anomaly[] }) {
  const [zoom, setZoom] = useState<Zoom>("full");

  const { data, totalPoints, sampled } = useMemo(() => {
    if (rows.length === 0) return { data: [] as Point[], totalPoints: 0, sampled: false };
    const lastTs = rows[rows.length - 1].timestamp.getTime();
    let sliced = rows;
    if (zoom === "1h") {
      const cutoff = lastTs - 60 * 60 * 1000;
      sliced = rows.filter((r) => r.timestamp.getTime() >= cutoff);
    } else if (zoom === "1d") {
      const cutoff = lastTs - 24 * 60 * 60 * 1000;
      sliced = rows.filter((r) => r.timestamp.getTime() >= cutoff);
    }

    // 1) downsample serie principal con LTTB
    const series = sliced.map((r) => ({ x: r.timestamp.getTime(), y: r.visibleStores, r }));
    const wasSampled = series.length > MAX_POINTS;
    const sampledSeries = wasSampled ? lttb(series, MAX_POINTS) : series;

    // 2) índice de anomalías por timestamp para mantenerlas todas visibles
    const dropMap = new Map<number, number>();
    const spikeMap = new Map<number, number>();
    const outlierMap = new Map<number, number>();
    for (const a of anomalies) {
      const t = a.timestamp.getTime();
      if (t < (sliced[0]?.timestamp.getTime() ?? 0)) continue;
      if (t > lastTs) continue;
      if (a.kind === "drop") dropMap.set(t, a.value);
      else if (a.kind === "spike") spikeMap.set(t, a.value);
      else outlierMap.set(t, a.value);
    }

    const fmtLabel = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mo} ${hh}:${mm}`;
    };

    // 3) merge: puntos de la serie + cualquier anomalía no incluida
    const points = new Map<number, Point>();
    for (const s of sampledSeries) {
      points.set(s.x, {
        ts: s.x,
        label: fmtLabel(new Date(s.x)),
        value: s.y,
        drop: dropMap.get(s.x) ?? null,
        spike: spikeMap.get(s.x) ?? null,
        outlier: outlierMap.get(s.x) ?? null,
      });
    }
    // asegurar que cada anomalía tenga un punto (aunque caiga fuera del downsample)
    const ensure = (m: Map<number, number>, key: "drop" | "spike" | "outlier") => {
      for (const [t, v] of m) {
        const existing = points.get(t);
        if (existing) {
          existing[key] = v;
        } else {
          points.set(t, {
            ts: t,
            label: fmtLabel(new Date(t)),
            value: v,
            drop: key === "drop" ? v : null,
            spike: key === "spike" ? v : null,
            outlier: key === "outlier" ? v : null,
          });
        }
      }
    };
    ensure(dropMap, "drop");
    ensure(spikeMap, "spike");
    ensure(outlierMap, "outlier");

    const sorted = Array.from(points.values()).sort((a, b) => a.ts - b.ts);
    return { data: sorted, totalPoints: sliced.length, sampled: wasSampled };
  }, [rows, anomalies, zoom]);

  const dropCount = data.filter((d) => d.drop !== null).length;
  const spikeCount = data.filter((d) => d.spike !== null).length;

  return (
    <div className="card-rappi p-5 relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background:
            "linear-gradient(90deg, var(--primary), var(--rappi-orange-light), var(--primary))",
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Serie temporal de tiendas visibles
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive" /> {dropCount} caídas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" /> {spikeCount} subidas
            </span>
            <span className="text-muted-foreground/70">
              · {fmtNum(totalPoints)} muestras{sampled ? ` (vista: ${MAX_POINTS})` : ""}
            </span>
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-full p-1 self-start">
          {(["1h", "1d", "full"] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                zoom === z
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {z === "1h" ? "Última hora" : z === "1d" ? "Último día" : "Completo"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="seriesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.645 0.218 32)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="oklch(0.645 0.218 32)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 286)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "oklch(0.55 0.015 286)" }}
              minTickGap={60}
              tickLine={false}
              axisLine={{ stroke: "oklch(0.92 0.005 286)" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.55 0.015 286)" }}
              tickFormatter={(v) => fmtNum(v as number)}
              width={50}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.18 0.01 286)",
                border: "none",
                borderRadius: 10,
                fontSize: 12,
                color: "white",
                padding: "8px 12px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}
              labelStyle={{ color: "oklch(0.85 0.005 286)", fontWeight: 600, marginBottom: 4 }}
              formatter={(value: number, name: string) => {
                if (name === "drop") return [`${fmtNum(value)} (caída)`, "Caída"];
                if (name === "spike") return [`${fmtNum(value)} (subida)`, "Subida"];
                if (name === "outlier") return [`${fmtNum(value)} (outlier)`, "Outlier"];
                return [fmtNum(value), "Tiendas"];
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="oklch(0.645 0.218 32)"
              strokeWidth={1.8}
              fill="url(#seriesFill)"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: "oklch(0.645 0.218 32)", stroke: "white", strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="oklch(0.645 0.218 32)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              legendType="none"
            />
            <Scatter
              dataKey="outlier"
              fill="oklch(0.78 0.16 70)"
              shape="circle"
              isAnimationActive={false}
            />
            <Scatter
              dataKey="drop"
              fill="oklch(0.628 0.237 27)"
              shape="circle"
              isAnimationActive={false}
            />
            <Scatter
              dataKey="spike"
              fill="oklch(0.55 0.17 145)"
              shape="circle"
              isAnimationActive={false}
            />
            <Brush
              dataKey="label"
              height={24}
              stroke="oklch(0.645 0.218 32)"
              travellerWidth={8}
              fill="oklch(0.97 0.005 286)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
