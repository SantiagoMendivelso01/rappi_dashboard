import type { Row } from "./csv";
import { dayEs, franja } from "./csv";

export type Filters = {
  dateFrom: string | null; // YYYY-MM-DD
  dateTo: string | null;
  days: string[]; // español
  franjas: string[];
  query: string;
};

export const emptyFilters: Filters = {
  dateFrom: null,
  dateTo: null,
  days: [],
  franjas: [],
  query: "",
};

export function applyFilters(rows: Row[], f: Filters): Row[] {
  return rows.filter((r) => {
    if (f.dateFrom && r.date < f.dateFrom) return false;
    if (f.dateTo && r.date > f.dateTo) return false;
    if (f.days.length && !f.days.includes(dayEs(r.dayOfWeek))) return false;
    if (f.franjas.length && !f.franjas.includes(franja(r.hour))) return false;
    if (f.query) {
      const q = f.query.toLowerCase();
      if (
        !r.date.includes(q) &&
        !dayEs(r.dayOfWeek).toLowerCase().includes(q) &&
        !String(r.hour).padStart(2, "0").includes(q)
      )
        return false;
    }
    return true;
  });
}

export type DailyAgg = {
  date: string;
  dayOfWeek: string;
  avg: number;
  min: number;
  max: number;
  peakHour: number;
  valleyHour: number;
  samples: number;
  availability: number; // % vs peak global
  coverage: number; // % de muestras reales (no interpoladas)
  incidents: number; // muestras interpoladas (huecos detectados)
};

export function aggregateByDay(rows: Row[], peakGlobal: number): DailyAgg[] {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, []);
    map.get(r.date)!.push(r);
  }
  const out: DailyAgg[] = [];
  for (const [date, rs] of map) {
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let peakHour = 0;
    let valleyHour = 0;
    let incidents = 0;
    for (const r of rs) {
      sum += r.visibleStores;
      if (r.visibleStores > max) {
        max = r.visibleStores;
        peakHour = r.hour;
      }
      if (r.visibleStores < min) {
        min = r.visibleStores;
        valleyHour = r.hour;
      }
      if (r.isInterpolated) incidents++;
    }
    const avg = sum / rs.length;
    out.push({
      date,
      dayOfWeek: rs[0]?.dayOfWeek ?? "",
      avg,
      min,
      max,
      peakHour,
      valleyHour,
      samples: rs.length,
      availability: peakGlobal > 0 ? (avg / peakGlobal) * 100 : 0,
      coverage: rs.length > 0 ? ((rs.length - incidents) / rs.length) * 100 : 0,
      incidents,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export function availabilityClass(pct: number): "ok" | "warn" | "bad" {
  if (pct >= 90) return "ok";
  if (pct >= 70) return "warn";
  return "bad";
}

export function heatmapMatrix(rows: Row[], peakGlobal: number) {
  // filas = día de la semana (Lun-Dom), columnas = hora 0-23
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sums = Array.from({ length: 7 }, () => Array(24).fill(0));
  const counts = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) {
    const di = dayOrder.indexOf(r.dayOfWeek);
    if (di < 0) continue;
    sums[di][r.hour] += r.visibleStores;
    counts[di][r.hour] += 1;
  }
  const matrix = sums.map((row, i) =>
    row.map((s, h) => {
      const c = counts[i][h];
      if (!c) return null;
      const avg = s / c;
      return peakGlobal > 0 ? (avg / peakGlobal) * 100 : 0;
    })
  );
  return { matrix, days: dayOrder.map(dayEs) };
}
