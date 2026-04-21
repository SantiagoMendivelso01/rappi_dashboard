import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
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
import type { Anomaly } from "@/lib/dashboard-data";
import { ZoomIn } from "lucide-react";

type Zoom = "1h" | "1d" | "full";

type Point = {
  ts: number;
  label: string;
  value: number;
  anomaly: number | null;
  anomalySev: Anomaly["severity"] | null;
};

export function TimeSeriesChart({ rows, anomalies }: { rows: Row[]; anomalies: Anomaly[] }) {
  const [zoom, setZoom] = useState<Zoom>("full");

  const data = useMemo<Point[]>(() => {
    if (rows.length === 0) return [];
    const anomMap = new Map<number, Anomaly>();
    for (const a of anomalies) anomMap.set(a.timestamp.getTime(), a);

    let sliced = rows;
    const lastTs = rows[rows.length - 1].timestamp.getTime();
    if (zoom === "1h") {
      const cutoff = lastTs - 60 * 60 * 1000;
      sliced = rows.filter((r) => r.timestamp.getTime() >= cutoff);
    } else if (zoom === "1d") {
      const cutoff = lastTs - 24 * 60 * 60 * 1000;
      sliced = rows.filter((r) => r.timestamp.getTime() >= cutoff);
    }

    return sliced.map((r) => {
      const ts = r.timestamp.getTime();
      const a = anomMap.get(ts);
      const d = r.timestamp;
      const dd = String(d.getDate()).padStart(2, "0");
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return {
        ts,
        label: `${dd}/${mo} ${hh}:${mm}`,
        value: r.visibleStores,
        anomaly: a ? r.visibleStores : null,
        anomalySev: a ? a.severity : null,
      };
    });
  }, [rows, anomalies, zoom]);

  const anomalyCount = data.filter((d) => d.anomaly !== null).length;

  return (
    <div className="card-rappi p-5 col-span-1 xl:col-span-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-primary" />
            Serie temporal de tiendas visibles
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {anomalyCount > 0
              ? `${anomalyCount} anomalías marcadas en rojo. Usa el brush inferior para hacer zoom.`
              : "Usa el brush inferior para hacer zoom en un rango."}
          </p>
        </div>
        <div className="flex gap-1 bg-muted rounded-full p-1 self-start">
          {(["1h", "1d", "full"] as Zoom[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                zoom === z ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
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
                <stop offset="5%" stopColor="oklch(0.65 0.22 27)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="oklch(0.65 0.22 27)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 286)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "oklch(0.55 0.015 286)" }}
              minTickGap={50}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.55 0.015 286)" }}
              tickFormatter={(v) => fmtNum(v as number)}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.18 0.01 286)",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                color: "white",
              }}
              labelStyle={{ color: "oklch(0.85 0.005 286)", fontWeight: 600 }}
              formatter={(value: number, name: string) => {
                if (name === "anomaly") return [`${fmtNum(value)} (anomalía)`, "Anomalía"];
                return [fmtNum(value), "Tiendas visibles"];
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="oklch(0.65 0.22 27)"
              strokeWidth={2}
              dot={false}
              fill="url(#seriesFill)"
              isAnimationActive={false}
            />
            <Scatter dataKey="anomaly" fill="oklch(0.55 0.25 27)" shape="circle" />
            <Brush
              dataKey="label"
              height={28}
              stroke="oklch(0.65 0.22 27)"
              travellerWidth={8}
              fill="oklch(0.97 0.005 286)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
