import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
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
};

const MAX_POINTS = 600;
const SERIES_COLOR = "oklch(0.645 0.218 32)"; // naranja Rappi
const ANOMALY_COLOR = "oklch(0.55 0.22 25)"; // rojo-naranja oscuro neutral

export function TimeSeriesChart({ rows, anomalies }: { rows: Row[]; anomalies: Anomaly[] }) {
  const [zoom, setZoom] = useState<Zoom>("full");

  const { data, totalPoints, sampled, visibleAnomalies, lastLabel } = useMemo(() => {
    if (rows.length === 0) {
      return {
        data: [] as Point[],
        totalPoints: 0,
        sampled: false,
        visibleAnomalies: [] as Anomaly[],
        lastLabel: "",
      };
    }
    const lastTs = rows[rows.length - 1].timestamp.getTime();
    let sliced = rows;
    if (zoom === "1h") {
      const cutoff = lastTs - 60 * 60 * 1000;
      sliced = rows.filter((r) => r.timestamp.getTime() >= cutoff);
    } else if (zoom === "1d") {
      const cutoff = lastTs - 24 * 60 * 60 * 1000;
      sliced = rows.filter((r) => r.timestamp.getTime() >= cutoff);
    }

    const series = sliced.map((r) => ({ x: r.timestamp.getTime(), y: r.visibleStores }));
    const wasSampled = series.length > MAX_POINTS;
    const sampledSeries = wasSampled ? lttb(series, MAX_POINTS) : series;

    const fmtLabel = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, "0");
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mo} ${hh}:${mm}`;
    };

    const points: Point[] = sampledSeries.map((s) => ({
      ts: s.x,
      label: fmtLabel(new Date(s.x)),
      value: s.y,
    }));

    // anomalías visibles dentro del rango actual
    const firstTs = sliced[0]?.timestamp.getTime() ?? 0;
    const visAnoms = anomalies.filter((a) => {
      const t = a.timestamp.getTime();
      return t >= firstTs && t <= lastTs;
    });

    // mapear cada anomalía al label del punto más cercano de la serie muestreada
    const labelByAnomalyTs = new Map<number, string>();
    if (points.length > 0) {
      for (const a of visAnoms) {
        const t = a.timestamp.getTime();
        let lo = 0;
        let hi = points.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (points[mid].ts < t) lo = mid + 1;
          else hi = mid;
        }
        const cand = points[lo];
        const prev = lo > 0 ? points[lo - 1] : cand;
        const nearest =
          Math.abs(cand.ts - t) < Math.abs(prev.ts - t) ? cand : prev;
        labelByAnomalyTs.set(t, nearest.label);
      }
    }

    const enriched = visAnoms
      .map((a) => ({ ...a, _label: labelByAnomalyTs.get(a.timestamp.getTime()) }))
      .filter((a): a is Anomaly & { _label: string } => Boolean(a._label));

    return {
      data: points,
      totalPoints: sliced.length,
      sampled: wasSampled,
      visibleAnomalies: enriched,
      lastLabel: points[points.length - 1]?.label ?? "",
    };
  }, [rows, anomalies, zoom]);

  return (
    <div className="card-rappi p-0 relative overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Tiendas visibles
          </h3>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: ANOMALY_COLOR }} />
              {visibleAnomalies.length} anomalías ±10%
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

      <div className="h-80 px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 56, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="seriesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.28} />
                <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 6"
              stroke="oklch(0.92 0.005 286)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "oklch(0.55 0.015 286)" }}
              minTickGap={80}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              orientation="right"
              tick={{ fontSize: 10, fill: "oklch(0.55 0.015 286)" }}
              tickFormatter={(v) => fmtNum(v as number)}
              width={48}
              tickLine={false}
              axisLine={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.18 0.01 286)",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                color: "white",
                padding: "6px 10px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              }}
              labelStyle={{ color: "oklch(0.85 0.005 286)", fontWeight: 600, marginBottom: 2 }}
              formatter={(value: number) => [fmtNum(value), "Tiendas"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={SERIES_COLOR}
              strokeWidth={1.6}
              fill="url(#seriesFill)"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: SERIES_COLOR, stroke: "white", strokeWidth: 2 }}
            />
            {/* línea punteada horizontal en último valor (estilo TradingView "cierre anterior") */}
            {data.length > 0 && (
              <ReferenceDot
                x={lastLabel}
                y={data[data.length - 1].value}
                r={3.5}
                fill={SERIES_COLOR}
                stroke="white"
                strokeWidth={1.5}
                isFront
              />
            )}
            {visibleAnomalies.map((a, idx) => (
              <ReferenceDot
                key={idx}
                x={(a as Anomaly & { _label: string })._label}
                y={a.value}
                r={4}
                fill={ANOMALY_COLOR}
                stroke="white"
                strokeWidth={1.5}
                isFront
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
