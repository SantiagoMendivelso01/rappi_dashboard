import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import type { Row } from "@/lib/csv";
import { fmtNum, franja } from "@/lib/csv";
import { hourlyAverage } from "@/lib/dashboard-data";

const PEAK_COLOR = "oklch(0.645 0.218 32)"; // naranja Rappi (primary)
const VALLEY_COLOR = "oklch(0.6 0.13 240)"; // azul medio
const MID_COLOR = "oklch(0.78 0.15 55)"; // naranja melón vibrante
const EMPTY_COLOR = "oklch(0.95 0.003 286)";

export function HourlyAvgChart({ rows }: { rows: Row[] }) {
  const data = useMemo(() => {
    const hourly = hourlyAverage(rows);
    if (hourly.every((h) => h.avg === 0)) return [];
    const withSamples = hourly.filter((h) => h.samples > 0);
    const max = Math.max(...withSamples.map((h) => h.avg));
    const min = Math.min(...withSamples.map((h) => h.avg));
    const range = max - min || 1;
    return hourly.map((h) => {
      let color = MID_COLOR;
      if (h.samples === 0) color = EMPTY_COLOR;
      else {
        const t = (h.avg - min) / range; // 0..1
        if (t >= 0.85) color = PEAK_COLOR;
        else if (t <= 0.15) color = VALLEY_COLOR;
      }
      return {
        hour: `${String(h.hour).padStart(2, "0")}h`,
        avg: Math.round(h.avg),
        franja: franja(h.hour),
        color,
        samples: h.samples,
      };
    });
  }, [rows]);

  return (
    <div className="card-rappi p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-foreground">Promedio por hora del día</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ¿Cuándo está la plataforma más cargada?
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: PEAK_COLOR }} />
            <span className="text-muted-foreground">Pico</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: VALLEY_COLOR }} />
            <span className="text-muted-foreground">Valle</span>
          </span>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 286)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10, fill: "oklch(0.55 0.015 286)" }}
              interval={1}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "oklch(0.55 0.015 286)" }}
              tickFormatter={(v) => {
                const n = v as number;
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
                return fmtNum(n);
              }}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "oklch(0.95 0.005 286 / 0.4)" }}
              wrapperStyle={{ outline: "none" }}
              contentStyle={{
                background: "oklch(1 0 0 / 0.96)",
                border: "1px solid oklch(0.9 0.005 286)",
                borderRadius: 10,
                fontSize: 12,
                color: "oklch(0.2 0.01 286)",
                boxShadow: "0 8px 24px -8px oklch(0.2 0.02 286 / 0.18)",
                padding: "8px 12px",
              }}
              labelStyle={{ color: "oklch(0.35 0.01 286)", fontWeight: 700, marginBottom: 2 }}
              itemStyle={{ color: "oklch(0.2 0.01 286)" }}
              formatter={(value: number, _n, p) => [
                `${fmtNum(value)} tiendas (${p.payload.franja})`,
                "Promedio",
              ]}
            />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
