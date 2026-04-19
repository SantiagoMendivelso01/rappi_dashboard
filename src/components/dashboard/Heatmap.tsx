import { useMemo } from "react";
import { heatmapMatrix } from "@/lib/dashboard-data";
import type { Row } from "@/lib/csv";
import { fmtPct } from "@/lib/csv";

export function Heatmap({ rows, peak }: { rows: Row[]; peak: number }) {
  const { matrix, days } = useMemo(() => heatmapMatrix(rows, peak), [rows, peak]);

  const colorFor = (v: number | null) => {
    if (v === null) return "oklch(0.96 0.003 286)";
    // gradient: bad (red) -> warn (amber) -> ok (green)
    if (v < 50) return `oklch(0.65 0.22 27 / ${0.5 + v / 100})`;
    if (v < 80) return `oklch(0.78 0.16 70 / ${0.5 + v / 200})`;
    return `oklch(0.72 0.18 145 / ${0.4 + v / 200})`;
  };

  return (
    <div className="card-rappi p-5">
      <h3 className="font-bold text-foreground">Mapa de calor: día × hora</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Disponibilidad promedio por hora del día y día de la semana.
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid" style={{ gridTemplateColumns: "60px repeat(24, 1fr)", gap: 2 }}>
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-[10px] text-muted-foreground text-center">
                {h}
              </div>
            ))}
            {matrix.map((row, di) => (
              <>
                <div key={`d${di}`} className="text-xs font-medium text-muted-foreground pr-2 flex items-center">
                  {days[di].slice(0, 3)}
                </div>
                {row.map((v, hi) => (
                  <div
                    key={`${di}-${hi}`}
                    className="aspect-square rounded-[3px] hover:ring-2 hover:ring-primary cursor-default transition"
                    style={{ background: colorFor(v) }}
                    title={v === null ? "Sin datos" : `${days[di]} ${hi}:00 → ${fmtPct(v)}`}
                  />
                ))}
              </>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span>Menor</span>
            <div className="flex h-2 flex-1 rounded-full overflow-hidden">
              <div className="flex-1" style={{ background: "oklch(0.65 0.22 27)" }} />
              <div className="flex-1" style={{ background: "oklch(0.78 0.16 70)" }} />
              <div className="flex-1" style={{ background: "oklch(0.72 0.18 145)" }} />
            </div>
            <span>Mayor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
