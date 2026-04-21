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

/**
 * Genera un resumen compacto en texto (Markdown) de los datos del dashboard
 * para enviar como contexto a la IA. Limita el tamaño para no saturar tokens.
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

  const lines: string[] = [];
  lines.push(`# Dashboard Rappi · ${fileName || "CSV"}`);
  lines.push(`Rango: ${rows[0].date} a ${rows[rows.length - 1].date}`);
  lines.push(`Total de muestras: ${fmt(rows.length)}`);
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
    lines.push(`- Hora pico: ${String(peakHour.hour).padStart(2, "0")}:00 → ${fmt(peakHour.avg)}`);
    lines.push(`- Hora valle: ${String(valleyHour.hour).padStart(2, "0")}:00 → ${fmt(valleyHour.avg)}`);
    lines.push("");
    lines.push("### Promedio por hora (todas)");
    for (const h of hourly) {
      lines.push(`- ${String(h.hour).padStart(2, "0")}:00 → ${fmt(h.avg)}`);
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
      `${d.date} | ${dayEs(d.dayOfWeek)} | ${fmt(d.avg)} | ${fmt(d.min)} | ${fmt(d.max)} | ${String(d.peakHour).padStart(2, "0")}:00 | ${String(d.valleyHour).padStart(2, "0")}:00`
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

  // Recortar de seguridad
  const text = lines.join("\n");
  return text.length > 28000 ? text.slice(0, 28000) + "\n…(truncado)" : text;
}
