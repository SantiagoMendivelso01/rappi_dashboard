import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Row } from "./csv";
import { dayEs, fmtNum } from "./csv";
import {
  aggregateByDay,
  computeGlobalStats,
  detectAnomalies,
  hourlyAverage,
  type Anomaly,
  type DailyAgg,
  type GlobalStats,
} from "./dashboard-data";

// Rappi orange (matches design system primary)
const RAPPI_ORANGE: [number, number, number] = [255, 68, 28];
const TEXT_DARK: [number, number, number] = [25, 25, 30];
const TEXT_MUTED: [number, number, number] = [110, 110, 120];
const BORDER: [number, number, number] = [228, 228, 232];
const BG_SOFT: [number, number, number] = [248, 248, 250];
const GREEN: [number, number, number] = [56, 142, 60];
const RED: [number, number, number] = [211, 47, 47];

const fmtTimestamp = (d: Date | null) => {
  if (!d) return "—";
  const date = d.toISOString().slice(0, 10);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
};

const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

export type ReportScope =
  | { kind: "all"; label: string }
  | { kind: "day"; date: string; label: string }
  | { kind: "range"; from: string; to: string; label: string };

export type ReportInput = {
  rows: Row[]; // already-filtered rows for the scope
  scope: ReportScope;
  fileName?: string;
};

export function generateReportPDF({ rows, scope, fileName }: ReportInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 0;

  // ----- Header band -----
  doc.setFillColor(...RAPPI_ORANGE);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Rappi · Informe de Disponibilidad", marginX, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(scope.label, marginX, 52);
  doc.text(
    `Generado: ${new Date().toLocaleString("es-ES")}`,
    pageW - marginX,
    52,
    { align: "right" }
  );

  y = 90;

  // ----- Empty data guard -----
  if (rows.length === 0) {
    doc.setTextColor(...TEXT_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Sin datos para el rango seleccionado", marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(
      "No hay registros que coincidan con el alcance del informe.",
      marginX,
      y + 18
    );
    doc.save(buildFilename(scope, fileName));
    return;
  }

  const anomalies = detectAnomalies(rows);
  const stats = computeGlobalStats(rows, anomalies);
  const daily = aggregateByDay(rows);
  const hourly = hourlyAverage(rows).filter((h) => h.samples > 0);

  // ----- Resumen meta -----
  doc.setTextColor(...TEXT_MUTED);
  doc.setFontSize(9);
  const firstTs = rows[0].timestamp;
  const lastTs = rows[rows.length - 1].timestamp;
  doc.text(
    `Registros: ${fmtNum(rows.length, 0)}  ·  Días: ${daily.length}  ·  Desde ${fmtTimestamp(firstTs)} hasta ${fmtTimestamp(lastTs)}`,
    marginX,
    y
  );
  y += 18;

  // ----- KPI grid -----
  y = drawKpiGrid(doc, y, marginX, pageW - marginX * 2, stats);
  y += 16;

  // ----- Promedio por hora -----
  y = ensureSpace(doc, y, 200);
  drawSectionTitle(doc, "Promedio por hora del día", marginX, y);
  y += 12;
  y = drawHourlyChart(doc, y, marginX, pageW - marginX * 2, hourly);
  y += 18;

  // ----- Detalle diario (tabla) -----
  y = ensureSpace(doc, y, 120);
  drawSectionTitle(doc, "Detalle diario", marginX, y);
  y += 8;
  y = drawDailyTable(doc, y, marginX, daily);
  y += 16;

  // ----- Anomalías -----
  if (anomalies.length > 0) {
    y = ensureSpace(doc, y, 120);
    drawSectionTitle(doc, `Anomalías detectadas (${anomalies.length})`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Cambios ≥ ±10% en 1 minuto · top 5 caídas + top 5 recuperaciones", marginX, y + 12);
    y += 22;
    y = drawAnomaliesTable(doc, y, marginX, anomalies);
  }

  // ----- Footer en todas las páginas -----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageH - 32, pageW - marginX, pageH - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Rappi · Store Availability Dashboard", marginX, pageH - 18);
    doc.text(`Página ${i} de ${total}`, pageW - marginX, pageH - 18, {
      align: "right",
    });
  }

  doc.save(buildFilename(scope, fileName));
}

// ---------- Helpers de dibujo ----------

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 50) {
    doc.addPage();
    return 50;
  }
  return y;
}

function drawSectionTitle(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...TEXT_DARK);
  doc.text(text, x, y);
}

function drawKpiGrid(
  doc: jsPDF,
  y: number,
  x: number,
  width: number,
  s: GlobalStats
): number {
  const cards: { label: string; value: string; sub: string; color?: [number, number, number] }[] = [
    {
      label: "Promedio global",
      value: fmtNum(s.avg, 0),
      sub: "tiendas visibles",
      color: RAPPI_ORANGE,
    },
    {
      label: "Máximo",
      value: fmtNum(s.max, 0),
      sub: fmtTimestamp(s.maxAt),
      color: GREEN,
    },
    {
      label: "Mínimo",
      value: fmtNum(s.min, 0),
      sub: fmtTimestamp(s.minAt),
      color: RED,
    },
    {
      label: "Tendencia 7d",
      value: `${s.trend7d >= 0 ? "+" : ""}${s.trend7d.toFixed(1)}%`,
      sub: "vs 7 días previos",
      color: s.trend7d >= 0 ? GREEN : RED,
    },
    {
      label: "Anomalías",
      value: fmtNum(s.anomaliesCount, 0),
      sub: "≥ ±10% en 1 min",
      color: s.anomaliesCount > 0 ? [220, 140, 0] : TEXT_MUTED,
    },
  ];
  const gap = 8;
  const cardW = (width - gap * (cards.length - 1)) / cards.length;
  const cardH = 60;
  cards.forEach((c, i) => {
    const cx = x + i * (cardW + gap);
    doc.setFillColor(...BG_SOFT);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.roundedRect(cx, y, cardW, cardH, 4, 4, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(c.label.toUpperCase(), cx + 8, y + 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...(c.color ?? TEXT_DARK));
    doc.text(c.value, cx + 8, y + 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXT_MUTED);
    const subLines = doc.splitTextToSize(c.sub, cardW - 16);
    doc.text(subLines, cx + 8, y + 46);
  });
  return y + cardH;
}

function drawHourlyChart(
  doc: jsPDF,
  y: number,
  x: number,
  width: number,
  hourly: { hour: number; avg: number; samples: number }[]
): number {
  const h = 140;
  const padL = 36;
  const padB = 22;
  const padT = 8;
  const padR = 8;
  const innerW = width - padL - padR;
  const innerH = h - padT - padB;

  // Background
  doc.setFillColor(...BG_SOFT);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, width, h, 4, 4, "FD");

  if (hourly.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("Sin datos por hora", x + width / 2, y + h / 2, { align: "center" });
    return y + h;
  }

  const maxV = Math.max(...hourly.map((d) => d.avg));
  const minV = Math.min(...hourly.map((d) => d.avg));
  const range = maxV - minV || 1;
  const baseX = x + padL;
  const baseY = y + padT + innerH;

  // Y axis labels (3 ticks)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  for (let i = 0; i <= 3; i++) {
    const v = minV + (range * i) / 3;
    const yy = baseY - (innerH * i) / 3;
    doc.text(fmtNum(v, 0), x + padL - 4, yy + 2, { align: "right" });
    doc.setDrawColor(235, 235, 238);
    doc.setLineWidth(0.3);
    doc.line(baseX, yy, baseX + innerW, yy);
  }

  // Bars
  const barGap = 2;
  const barW = (innerW - barGap * (hourly.length - 1)) / hourly.length;
  hourly.forEach((d, i) => {
    const norm = (d.avg - minV) / range;
    const bh = norm * innerH;
    const bx = baseX + i * (barW + barGap);
    const by = baseY - bh;
    // Color: peak orange (top 15%), valley blue (bottom 15%), neutral otherwise
    let color: [number, number, number];
    if (norm >= 0.85) color = RAPPI_ORANGE;
    else if (norm <= 0.15) color = [70, 130, 180];
    else color = [210, 200, 190];
    doc.setFillColor(...color);
    doc.rect(bx, by, barW, bh, "F");
    // hour label every 3
    if (d.hour % 3 === 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(fmtHour(d.hour), bx + barW / 2, baseY + 12, { align: "center" });
    }
  });

  return y + h;
}

function drawDailyTable(doc: jsPDF, y: number, x: number, daily: DailyAgg[]): number {
  autoTable(doc, {
    startY: y + 4,
    margin: { left: x, right: x },
    head: [["Fecha", "Día", "Promedio", "Mín", "Máx", "Hora pico", "Hora valle", "Muestras"]],
    body: daily.map((d) => [
      d.date,
      dayEs(d.dayOfWeek),
      fmtNum(d.avg, 0),
      fmtNum(d.min, 0),
      fmtNum(d.max, 0),
      fmtHour(d.peakHour),
      fmtHour(d.valleyHour),
      fmtNum(d.samples, 0),
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: TEXT_DARK },
    headStyles: { fillColor: RAPPI_ORANGE, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: BG_SOFT },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "right" },
    },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  return doc.lastAutoTable.finalY;
}

function drawAnomaliesTable(
  doc: jsPDF,
  y: number,
  x: number,
  anomalies: Anomaly[]
): number {
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    head: [["Tipo", "Severidad", "Timestamp", "Valor", "Esperado", "Δ", "Δ %"]],
    body: anomalies.map((a) => [
      a.kind === "drop" ? "Caída" : "Recuperación",
      a.severity === "critical" ? "Crítica" : a.severity === "moderate" ? "Moderada" : "Recuperación",
      fmtTimestamp(a.timestamp),
      fmtNum(a.value, 0),
      fmtNum(a.expected, 0),
      `${a.delta >= 0 ? "+" : ""}${fmtNum(a.delta, 0)}`,
      `${a.deltaPct >= 0 ? "+" : ""}${a.deltaPct.toFixed(1)}%`,
    ]),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4, textColor: TEXT_DARK },
    headStyles: { fillColor: TEXT_DARK, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: BG_SOFT },
    columnStyles: {
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const raw = String(data.cell.raw ?? "");
        if (raw.startsWith("+")) data.cell.styles.textColor = GREEN;
        else if (raw.startsWith("-")) data.cell.styles.textColor = RED;
      }
    },
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  return doc.lastAutoTable.finalY;
}

function buildFilename(scope: ReportScope, fileName?: string): string {
  const base = fileName ? fileName.replace(/\.[^.]+$/, "") : "rappi";
  const stamp = new Date().toISOString().slice(0, 10);
  let suffix = "todo";
  if (scope.kind === "day") suffix = scope.date;
  else if (scope.kind === "range") suffix = `${scope.from}_a_${scope.to}`;
  return `informe_${base}_${suffix}_${stamp}.pdf`;
}
