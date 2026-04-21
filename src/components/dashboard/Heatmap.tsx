import { useMemo } from "react";
import { dayEs, fmtNum, type Row } from "@/lib/csv";
import { Flame } from "lucide-react";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function Heatmap({ rows }: { rows: Row[]; peak?: number }) {
  const { matrix, days, min, max } = useMemo(() => {
    const sums = Array.from({ length: 7 }, () => Array(24).fill(0));
    const counts = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const r of rows) {
      const di = DAY_ORDER.indexOf(r.dayOfWeek);
      if (di < 0) continue;
      sums[di][r.hour] += r.visibleStores;
      counts[di][r.hour] += 1;
    }
    let mn = Infinity;
    let mx = -Infinity;
    const m = sums.map((row, i) =>
      row.map((s, h) => {
        const c = counts[i][h];
        if (!c) return null;
        const avg = s / c;
        if (avg < mn) mn = avg;
        if (avg > mx) mx = avg;
        return avg;
      })
    );
    if (!isFinite(mn)) mn = 0;
    if (!isFinite(mx)) mx = 0;
    return { matrix: m, days: DAY_ORDER.map(dayEs), min: mn, max: mx };
  }, [rows]);

  // escala normalizada al rango real observado, para que se aprecien diferencias
  const colorFor = (v: number | null) => {
    if (v === null) return "oklch(0.96 0.003 286)";
    const range = max - min || 1;
    const t = (v - min) / range; // 0..1
    // azul (frío) -> naranja Rappi (caliente)
    if (t < 0.33) {
      return `oklch(${0.78 - t * 0.1} 0.12 250 / ${0.45 + t})`;
    }
    if (t < 0.66) {
      return `oklch(${0.78 - t * 0.05} 0.16 70 / ${0.55 + t * 0.4})`;
    }
    return `oklch(${0.7 - (t - 0.66) * 0.15} 0.22 32 / ${0.65 + t * 0.35})`;
  };

  return (
    <div className="card-rappi p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Flame className="w-4 h-4 text-primary" />
            Mapa de calor: día × hora
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Promedio de tiendas visibles. Rango: {fmtNum(min)} – {fmtNum(max)}.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid" style={{ gridTemplateColumns: "44px repeat(24, 1fr)", gap: 2 }}>
            <div />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-[10px] text-muted-foreground text-center font-medium">
                {h}
              </div>
            ))}
            {matrix.map((row, di) => (
              <div key={`d${di}`} className="contents">
                <div className="text-xs font-semibold text-muted-foreground pr-2 flex items-center">
                  {days[di].slice(0, 3)}
                </div>
                {row.map((v, hi) => (
                  <div
                    key={`${di}-${hi}`}
                    className="aspect-square rounded-[3px] hover:ring-2 hover:ring-primary cursor-default transition"
                    style={{ background: colorFor(v) }}
                    title={
                      v === null
                        ? "Sin datos"
                        : `${days[di]} ${hi}:00 → ${fmtNum(v)} tiendas`
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
            <span>{fmtNum(min)}</span>
            <div className="flex h-2 flex-1 rounded-full overflow-hidden">
              <div className="flex-1" style={{ background: "oklch(0.7 0.12 250)" }} />
              <div className="flex-1" style={{ background: "oklch(0.75 0.16 70)" }} />
              <div className="flex-1" style={{ background: "oklch(0.645 0.218 32)" }} />
            </div>
            <span>{fmtNum(max)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
