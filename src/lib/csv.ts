// Parser CSV manual (coma o punto y coma). Sin librerías.
export type Row = {
  timestamp: Date;
  visibleStores: number;
  date: string; // YYYY-MM-DD
  hour: number;
  minute: number;
  dayOfWeek: string;
  dayOfWeekNum: number;
  isInterpolated: boolean;
};

const DAY_ES: Record<string, string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miércoles",
  Thursday: "Jueves",
  Friday: "Viernes",
  Saturday: "Sábado",
  Sunday: "Domingo",
};

export const dayEs = (en: string) => DAY_ES[en] ?? en;

function detectDelim(line: string): string {
  const c = (line.match(/,/g) || []).length;
  const sc = (line.match(/;/g) || []).length;
  return sc > c ? ";" : ",";
}

function splitCSVLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("El archivo está vacío o no tiene datos.");
  const delim = detectDelim(lines[0]);
  const headers = splitCSVLine(lines[0], delim).map((h) => h.toLowerCase());

  const idx = (name: string) => headers.indexOf(name);
  const iTs = idx("timestamp");
  const iVis = idx("visible_stores");
  const iDate = idx("date");
  const iHour = idx("hour");
  const iMin = idx("minute");
  const iDow = idx("day_of_week");
  const iDowN = idx("day_of_week_num");
  const iInterp = idx("is_interpolated");

  if (iTs < 0 || iVis < 0)
    throw new Error(
      "Formato no reconocido. Se esperan columnas: timestamp, visible_stores, date, hour, minute, day_of_week..."
    );

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i], delim);
    const tsStr = cols[iTs];
    const vis = parseFloat(cols[iVis]);
    if (!tsStr || isNaN(vis)) continue;
    const ts = new Date(tsStr.replace(" ", "T"));
    if (isNaN(ts.getTime())) continue;
    rows.push({
      timestamp: ts,
      visibleStores: vis,
      date: iDate >= 0 ? cols[iDate] : tsStr.slice(0, 10),
      hour: iHour >= 0 ? parseInt(cols[iHour], 10) : ts.getHours(),
      minute: iMin >= 0 ? parseInt(cols[iMin], 10) : ts.getMinutes(),
      dayOfWeek: iDow >= 0 ? cols[iDow] : "",
      dayOfWeekNum: iDowN >= 0 ? parseInt(cols[iDowN], 10) : ts.getDay(),
      isInterpolated: iInterp >= 0 ? cols[iInterp].toLowerCase() === "true" : false,
    });
  }
  if (rows.length === 0) throw new Error("No se pudo parsear ninguna fila válida.");
  rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return rows;
}

export const fmtNum = (n: number, decimals = 0) =>
  n.toLocaleString("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const fmtPct = (n: number) => `${fmtNum(n, 1)}%`;

export function franja(h: number): string {
  if (h < 6) return "Madrugada";
  if (h < 12) return "Mañana";
  if (h < 18) return "Tarde";
  return "Noche";
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
