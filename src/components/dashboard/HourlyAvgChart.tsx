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

const PEAK_COLOR = "oklch(0.7 0.18 50)"; // naranja
const VALLEY_COLOR = "oklch(0.55 0.15 250)"; // azul
const MID_COLOR = "oklch(0.78 0.04 286)"; // neutro

export function HourlyAvgChart({ rows }: { rows: Row[] }) {
  const data = useMemo(() => {
    const hourly = hourlyAverage(rows);
    if (hourly.every((h) => h.avg === 0)) return [];
    const max = Math.max(...hourly.map((h) => h.avg));
    const min = Math.min(...hourly.filter((h) => h.samples > 0).map((h) => h.avg));
    return hourly.map((h) => {
      let color = MID_COLOR;
      if (h.samples === 0) color = "oklch(0.95 0.003 286)";
      else if (h.avg >= max * 0.92) color = PEAK_COLOR;
      else if (h.avg <= min * 1.08 && h.avg > 0) color = VALLEY_COLOR;
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
              tickFormatter={(v) => fmtNum(v as number)}
              width={50}
            />
            <Tooltip
              cursor={{ fill: "oklch(0.95 0.005 286)" }}
              contentStyle={{
                background: "oklch(0.18 0.01 286)",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                color: "white",
              }}
              labelStyle={{ color: "oklch(0.85 0.005 286)", fontWeight: 600 }}
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
