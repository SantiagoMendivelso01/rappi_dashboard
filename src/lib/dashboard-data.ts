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
};

export function aggregateByDay(rows: Row[], _peakGlobal?: number): DailyAgg[] {
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
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
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
 * Detección de anomalías basada en cambios porcentuales y outliers ±2σ
 * (equivalente al script pandas: pct_change WINDOW=6 + rolling mean/std de 30 muestras).
 *
 * - drop:   pct_change_1min < -1%   (caída brusca en 6 muestras)
 * - spike:  pct_change_1min > +1%   (subida brusca en 6 muestras)
 * - outlier: valor fuera de la banda ±2σ del rolling mean (30 muestras)
 *
 * Cada anomalía se clasifica por severidad según la magnitud del cambio %.
 */
export type AnomalyKind = "drop" | "spike" | "outlier";

export type Anomaly = {
  timestamp: Date;
  date: string;
  hour: number;
  minute: number;
  value: number;
  expected: number; // rolling mean local (banda central)
  delta: number;
  deltaPct: number; // pct_change_1min (cambio % en 6 muestras)
  z: number; // desvío estándar respecto a rolling mean
  severity: "critical" | "moderate" | "recovery";
  kind: AnomalyKind;
};

const PCT_WINDOW = 6; // 6 muestras = ~1 min si cada muestra es 10s
const ROLL_WINDOW = 30; // ~5 min (se mantiene para 'expected')
const DROP_THRESHOLD = -10.0; // ±10% en 1 min
const SPIKE_THRESHOLD = 10.0;
const MAX_ANOMALIES = 5; // solo las 5 más bruscas

function rollingStats(values: number[], window: number) {
  const n = values.length;
  const mean = new Array<number | null>(n).fill(null);
  const std = new Array<number | null>(n).fill(null);
  const half = Math.floor(window / 2);
  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(n, i + half + 1);
    const len = end - start;
    if (len < Math.min(window, 5)) continue;
    let s = 0;
    for (let j = start; j < end; j++) s += values[j];
    const m = s / len;
    let v = 0;
    for (let j = start; j < end; j++) v += (values[j] - m) ** 2;
    mean[i] = m;
    std[i] = Math.sqrt(v / len);
  }
  return { mean, std };
}

export function detectAnomalies(rows: Row[]): Anomaly[] {
  if (rows.length < PCT_WINDOW + 2) return [];
  const n = rows.length;
  const values = rows.map((r) => r.visibleStores);
  const { mean, std } = rollingStats(values, ROLL_WINDOW);

  const out: Anomaly[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const v = values[i];
    const m = mean[i] ?? v;
    const sd = std[i] ?? 0;

    // 1) pct_change en ventana de 1 min (6 muestras)
    let pct: number | null = null;
    if (i >= PCT_WINDOW) {
      const prev = values[i - PCT_WINDOW];
      if (prev !== 0) pct = ((v - prev) / prev) * 100;
    }

    let kind: AnomalyKind | null = null;
    if (pct !== null && pct <= DROP_THRESHOLD) kind = "drop";
    else if (pct !== null && pct >= SPIKE_THRESHOLD) kind = "spike";

    if (!kind) continue;
    if (seen.has(i)) continue;
    seen.add(i);

    const deltaPct = pct ?? 0;
    const z = sd > 0 ? (v - m) / sd : 0;
    const absPct = Math.abs(deltaPct);
    const severity: Anomaly["severity"] =
      kind === "drop" ? (absPct >= 20 ? "critical" : "moderate") : "recovery";

    out.push({
      timestamp: r.timestamp,
      date: r.date,
      hour: r.hour,
      minute: r.minute,
      value: v,
      expected: m,
      delta: v - m,
      deltaPct,
      z,
      severity,
      kind,
    });
  }

  // Solo las 5 anomalías más bruscas (mayor magnitud de cambio porcentual)
  out.sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
  return out.slice(0, MAX_ANOMALIES);
}

/**
 * Largest-Triangle-Three-Buckets downsampling.
 * Reduce un array de puntos {x,y} preservando la forma visual de la serie.
 */
export function lttb<T extends { x: number; y: number }>(data: T[], threshold: number): T[] {
  const n = data.length;
  if (threshold >= n || threshold <= 2) return data;
  const sampled: T[] = [];
  const every = (n - 2) / (threshold - 2);
  let a = 0;
  sampled.push(data[a]);
  for (let i = 0; i < threshold - 2; i++) {
    let avgX = 0;
    let avgY = 0;
    const rangeStart = Math.floor((i + 1) * every) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * every) + 1, n);
    const rangeLen = rangeEnd - rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }
    avgX /= rangeLen || 1;
    avgY /= rangeLen || 1;

    const rangeOffs = Math.floor(i * every) + 1;
    const rangeTo = Math.floor((i + 1) * every) + 1;
    const pointAX = data[a].x;
    const pointAY = data[a].y;
    let maxArea = -1;
    let nextA = rangeOffs;
    for (let j = rangeOffs; j < rangeTo; j++) {
      const area = Math.abs(
        (pointAX - avgX) * (data[j].y - pointAY) - (pointAX - data[j].x) * (avgY - pointAY)
      );
      if (area > maxArea) {
        maxArea = area;
        nextA = j;
      }
    }
    sampled.push(data[nextA]);
    a = nextA;
  }
  sampled.push(data[n - 1]);
  return sampled;
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
