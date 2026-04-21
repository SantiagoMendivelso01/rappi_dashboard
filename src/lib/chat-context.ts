import type { Row } from "@/lib/csv";
import {
  aggregateByDay,
  computeGlobalStats,
  detectAnomalies,
  hourlyAverage,
} from "@/lib/dashboard-data";

const fmt = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString("es-MX", { maximumFractionDigits: d }) : "—";

const fmtTs = (d: Date | null) => {
  if (!d) return "—";
  const date = d.toISOString().slice(0, 10);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
};

const dayEs = (en: string) =>
  ({
    Monday: "Lunes",
    Tuesday: "Martes",
    Wednesday: "Miércoles",
    Thursday: "Jueves",
    Friday: "Viernes",
    Saturday: "Sábado",
    Sunday: "Domingo",
  })[en] ?? en;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Genera un resumen compacto en texto (Markdown) de los datos del dashboard
 * para enviar como contexto a la IA. Incluye datos granulares minuto a minuto
 * comprimidos para los días clave, y un downsample horario para el resto.
 */
export function buildDashboardContext(rows: Row[], fileName: string): string {
  if (rows.length === 0) return "No hay datos cargados.";

  const stats = computeGlobalStats(rows, []);
  const anomalies = detectAnomalies(rows);
  const daily = aggregateByDay(rows);
  const hourly = hourlyAverage(rows);

  const dropTop = anomalies.filter((a) => a.kind === "drop").slice(0, 5);
  const upTop = anomalies.filter((a) => a.kind === "spike").slice(0, 5);

  const bestDay = [...daily].sort((a, b) => b.avg - a.avg)[0];
  const worstDay = [...daily].sort((a, b) => a.avg - b.avg)[0];
  const peakHour = [...hourly].sort((a, b) => b.avg - a.avg)[0];
  const valleyHour = [...hourly]
    .filter((h) => h.samples > 0)
    .sort((a, b) => a.avg - b.avg)[0];

  // Indexar filas por fecha para acceso rápido
  const rowsByDate = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = rowsByDate.get(r.date);
    if (arr) arr.push(r);
    else rowsByDate.set(r.date, [r]);
  }

  // Días clave para incluir granular: mejor, peor, días con anomalías top
  const keyDates = new Set<string>();
  if (bestDay) keyDates.add(bestDay.date);
  if (worstDay) keyDates.add(worstDay.date);
  for (const a of [...dropTop, ...upTop]) keyDates.add(a.date);

  const lines: string[] = [];
  lines.push(`# Dashboard Rappi · ${fileName || "CSV"}`);
  lines.push(`Rango: ${rows[0].date} a ${rows[rows.length - 1].date}`);
  lines.push(`Total de muestras minuto a minuto: ${fmt(rows.length)}`);
  lines.push(`Granularidad base: 1 minuto`);
  lines.push("");
  lines.push("## KPIs globales");
  lines.push(`- Promedio: ${fmt(stats.avg)} tiendas`);
  lines.push(`- Máximo: ${fmt(stats.max)} (${fmtTs(stats.maxAt)})`);
  lines.push(`- Mínimo: ${fmt(stats.min)} (${fmtTs(stats.minAt)})`);
  lines.push(`- Tendencia 7d: ${stats.trend7d.toFixed(2)}%`);
  lines.push(`- Anomalías detectadas (±10% en 1 min): ${anomalies.length}`);
  lines.push("");

  if (peakHour && valleyHour) {
    lines.push("## Hora del día");
    lines.push(`- Hora pico: ${pad2(peakHour.hour)}:00 → ${fmt(peakHour.avg)}`);
    lines.push(`- Hora valle: ${pad2(valleyHour.hour)}:00 → ${fmt(valleyHour.avg)}`);
    lines.push("");
    lines.push("### Promedio por hora (todas)");
    for (const h of hourly) {
      lines.push(`- ${pad2(h.hour)}:00 → ${fmt(h.avg)}`);
    }
    lines.push("");
  }

  if (bestDay && worstDay) {
    lines.push("## Días destacados");
    lines.push(
      `- Mejor día: ${bestDay.date} (${dayEs(bestDay.dayOfWeek)}) → promedio ${fmt(bestDay.avg)}`
    );
    lines.push(
      `- Peor día: ${worstDay.date} (${dayEs(worstDay.dayOfWeek)}) → promedio ${fmt(worstDay.avg)}`
    );
    lines.push("");
  }

  // Detalle diario (limitar a 60 días para acotar tokens)
  const dailyShown = daily.slice(-60);
  lines.push(`## Detalle diario (últimos ${dailyShown.length} días)`);
  lines.push("fecha | día | promedio | min | max | hora_pico | hora_valle");
  for (const d of dailyShown) {
    lines.push(
      `${d.date} | ${dayEs(d.dayOfWeek)} | ${fmt(d.avg)} | ${fmt(d.min)} | ${fmt(d.max)} | ${pad2(d.peakHour)}:00 | ${pad2(d.valleyHour)}:00`
    );
  }
  lines.push("");

  if (dropTop.length > 0) {
    lines.push("## Top 5 caídas más bruscas");
    for (const a of dropTop) {
      lines.push(
        `- ${fmtTs(a.timestamp)} → ${fmt(a.value)} tiendas (esperado ${fmt(a.expected)}, Δ ${a.deltaPct.toFixed(2)}%, severidad ${a.severity})`
      );
    }
    lines.push("");
  }

  if (upTop.length > 0) {
    lines.push("## Top 5 recuperaciones más bruscas");
    for (const a of upTop) {
      lines.push(
        `- ${fmtTs(a.timestamp)} → ${fmt(a.value)} tiendas (esperado ${fmt(a.expected)}, Δ +${a.deltaPct.toFixed(2)}%)`
      );
    }
    lines.push("");
  }

  // ============================================================
  // DATOS GRANULARES MINUTO A MINUTO (días clave, completos)
  // ============================================================
  if (keyDates.size > 0) {
    lines.push("## Datos minuto a minuto · días clave");
    lines.push(
      "Formato compacto: HH:MM=valor separado por espacios. Cada bloque es un día completo."
    );
    lines.push("");
    const sortedKey = [...keyDates].sort();
    for (const date of sortedKey) {
      const dayRows = rowsByDate.get(date);
      if (!dayRows || dayRows.length === 0) continue;
      const sorted = [...dayRows].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const tag: string[] = [];
      if (bestDay?.date === date) tag.push("MEJOR");
      if (worstDay?.date === date) tag.push("PEOR");
      const hasAnom = anomalies.some((a) => a.date === date);
      if (hasAnom) tag.push("CON ANOMALÍAS");
      const tagStr = tag.length ? ` [${tag.join(", ")}]` : "";
      lines.push(
        `### ${date} (${dayEs(sorted[0].dayOfWeek)})${tagStr} · ${sorted.length} muestras`
      );
      // Comprimir en líneas por hora para legibilidad
      const byHour = new Map<number, string[]>();
      for (const r of sorted) {
        const arr = byHour.get(r.hour) ?? [];
        arr.push(`${pad2(r.minute)}=${r.visibleStores}`);
        byHour.set(r.hour, arr);
      }
      const hours = [...byHour.keys()].sort((a, b) => a - b);
      for (const h of hours) {
        lines.push(`${pad2(h)}h ${byHour.get(h)!.join(" ")}`);
      }
      lines.push("");
    }
  }

  // ============================================================
  // SERIE HORARIA COMPLETA (downsample 1/hora para todo el dataset)
  // Permite a la IA razonar sobre la evolución temporal completa
  // ============================================================
  lines.push("## Serie temporal completa (resolución horaria)");
  lines.push("Formato: fecha HH=valor (promedio de tiendas visibles en esa hora).");
  // Agrupar por (fecha, hora) y promediar
  type HK = { date: string; hour: number; sum: number; n: number; dow: string };
  const hourlyMap = new Map<string, HK>();
  for (const r of rows) {
    const k = `${r.date}|${r.hour}`;
    const cur = hourlyMap.get(k);
    if (cur) {
      cur.sum += r.visibleStores;
      cur.n += 1;
    } else {
      hourlyMap.set(k, {
        date: r.date,
        hour: r.hour,
        sum: r.visibleStores,
        n: 1,
        dow: r.dayOfWeek,
      });
    }
  }
  const hourlySeries = [...hourlyMap.values()].sort((a, b) =>
    a.date === b.date ? a.hour - b.hour : a.date < b.date ? -1 : 1
  );
  // Agrupar por fecha en líneas
  const byDate = new Map<string, { dow: string; entries: string[] }>();
  for (const h of hourlySeries) {
    const avg = Math.round(h.sum / h.n);
    const entry = `${pad2(h.hour)}=${avg}`;
    const cur = byDate.get(h.date);
    if (cur) cur.entries.push(entry);
    else byDate.set(h.date, { dow: h.dow, entries: [entry] });
  }
  for (const [date, info] of byDate) {
    lines.push(`${date} (${dayEs(info.dow)}): ${info.entries.join(" ")}`);
  }
  lines.push("");

  // Recortar de seguridad (más generoso ahora: 60k chars ≈ 15-18k tokens)
  const text = lines.join("\n");
  const MAX = 60000;
  return text.length > MAX ? text.slice(0, MAX) + "\n…(truncado por límite de tokens)" : text;
}
