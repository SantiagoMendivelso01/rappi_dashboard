import type { Row } from "./csv";
import { dayEs, franja } from "./csv";

export type PeriodPreset = "all" | "today" | "week";

export type Filters = {
  period: PeriodPreset;
  dateFrom: string | null; // YYYY-MM-DD
  dateTo: string | null;
  days: string[]; // español
  franjas: string[];
  query: string;
};

export const emptyFilters: Filters = {
  period: "all",
  dateFrom: null,
  dateTo: null,
  days: [],
  franjas: [],
  query: "",
};

/**
 * Resuelve un preset de período relativo a la fecha más reciente del CSV.
 * Devuelve { from, to } en formato YYYY-MM-DD o null si no aplica.
 */
export function resolvePeriod(
  rows: Row[],
  period: PeriodPreset
): { from: string | null; to: string | null } {
  if (period === "all" || rows.length === 0) return { from: null, to: null };
  const maxDate = rows[rows.length - 1].date;
  if (period === "today") return { from: maxDate, to: maxDate };
  // week: últimos 7 días naturales hasta maxDate (inclusive)
  const d = new Date(maxDate + "T00:00:00");
  d.setDate(d.getDate() - 6);
  const from = d.toISOString().slice(0, 10);
  return { from, to: maxDate };
}

export function applyFilters(rows: Row[], f: Filters): Row[] {
  const preset = resolvePeriod(rows, f.period);
  const from = f.dateFrom ?? preset.from;
  const to = f.dateTo ?? preset.to;
  return rows.filter((r) => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
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
  coverage: number;
  incidents: number;
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

// =====================================================================
// MÉTRICAS OPERACIONALES (KPIs, anomalías, tendencia)
// =====================================================================

export type GlobalStats = {
  avg: number;
  max: number;
  maxAt: Date | null;
  min: number;
  minAt: Date | null;
  trend7d: number; // % cambio últimos 7d vs 7d previos
  anomaliesCount: number;
};

/**
 * Detección de anomalías por z-score sobre la serie de visibleStores.
 * Una observación es anómala si |z| > threshold (default 2.5).
 */
export type Anomaly = {
  timestamp: Date;
  date: string;
  hour: number;
  minute: number;
  value: number;
  expected: number;
  delta: number; // diferencia absoluta vs media
  deltaPct: number; // % vs media
  z: number;
  severity: "critical" | "moderate" | "recovery";
};

export function detectAnomalies(rows: Row[], threshold = 2.5): Anomaly[] {
  if (rows.length < 10) return [];
  const values = rows.map((r) => r.visibleStores);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 1;

  const out: Anomaly[] = [];
  for (const r of rows) {
    const z = (r.visibleStores - mean) / std;
    if (Math.abs(z) < threshold) continue;
    const delta = r.visibleStores - mean;
    const deltaPct = (delta / mean) * 100;
    let severity: Anomaly["severity"];
    if (z <= -3.5) severity = "critical";
    else if (z < 0) severity = "moderate";
    else severity = "recovery";
    out.push({
      timestamp: r.timestamp,
      date: r.date,
      hour: r.hour,
      minute: r.minute,
      value: r.visibleStores,
      expected: mean,
      delta,
      deltaPct,
      z,
      severity,
    });
  }
  // ordenar por severidad (más negativo primero), luego por fecha
  out.sort((a, b) => {
    const sevOrder = { critical: 0, moderate: 1, recovery: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return a.z - b.z;
  });
  return out;
}

export function computeGlobalStats(rows: Row[], anomalies: Anomaly[]): GlobalStats {
  if (rows.length === 0) {
    return {
      avg: 0,
      max: 0,
      maxAt: null,
      min: 0,
      minAt: null,
      trend7d: 0,
      anomaliesCount: 0,
    };
  }
  let sum = 0;
  let max = -Infinity;
  let maxAt: Date | null = null;
  let min = Infinity;
  let minAt: Date | null = null;
  for (const r of rows) {
    sum += r.visibleStores;
    if (r.visibleStores > max) {
      max = r.visibleStores;
      maxAt = r.timestamp;
    }
    if (r.visibleStores < min) {
      min = r.visibleStores;
      minAt = r.timestamp;
    }
  }
  const avg = sum / rows.length;

  // tendencia 7d: comparar promedio últimos 7 días vs 7 días previos
  const maxDate = rows[rows.length - 1].date;
  const d = new Date(maxDate + "T00:00:00");
  const last7Start = new Date(d);
  last7Start.setDate(last7Start.getDate() - 6);
  const prev7End = new Date(last7Start);
  prev7End.setDate(prev7End.getDate() - 1);
  const prev7Start = new Date(prev7End);
  prev7Start.setDate(prev7Start.getDate() - 6);

  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const last7 = rows.filter((r) => r.date >= iso(last7Start) && r.date <= maxDate);
  const prev7 = rows.filter((r) => r.date >= iso(prev7Start) && r.date <= iso(prev7End));
  const avg7 = last7.length ? last7.reduce((s, r) => s + r.visibleStores, 0) / last7.length : 0;
  const avgPrev = prev7.length ? prev7.reduce((s, r) => s + r.visibleStores, 0) / prev7.length : 0;
  const trend7d = avgPrev > 0 ? ((avg7 - avgPrev) / avgPrev) * 100 : 0;

  return { avg, max, maxAt, min, minAt, trend7d, anomaliesCount: anomalies.length };
}

/** Promedio de visibleStores por hora del día (0-23). */
export function hourlyAverage(rows: Row[]): { hour: number; avg: number; samples: number }[] {
  const sums = Array(24).fill(0);
  const counts = Array(24).fill(0);
  for (const r of rows) {
    sums[r.hour] += r.visibleStores;
    counts[r.hour] += 1;
  }
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    avg: counts[h] ? sums[h] / counts[h] : 0,
    samples: counts[h],
  }));
}
