import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { DailyAgg } from "@/lib/dashboard-data";
import { dayEs, fmtPct } from "@/lib/csv";

export function AlertsPanel({ daily }: { daily: DailyAgg[] }) {
  const [open, setOpen] = useState(true);
  const alerts = daily.filter((d) => d.availability < 70).sort((a, b) => a.availability - b.availability);

  return (
    <div className="card-rappi overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[oklch(0.78_0.16_70_/_0.15)] flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[oklch(0.6_0.16_70)]" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-foreground">Alertas de baja disponibilidad</h3>
            <p className="text-xs text-muted-foreground">
              {alerts.length === 0
                ? "Sin días críticos en el período filtrado"
                : `${alerts.length} día(s) con disponibilidad < 70%`}
            </p>
          </div>
        </div>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && alerts.length > 0 && (
        <div className="border-t border-border divide-y divide-border max-h-80 overflow-y-auto">
          {alerts.map((a) => (
            <div key={a.date} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-[oklch(0.6_0.16_70)]" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{a.date}</p>
                  <p className="text-xs text-muted-foreground">
                    {dayEs(a.dayOfWeek)} · valle a las {String(a.valleyHour).padStart(2, "0")}:00
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive">
                {fmtPct(a.availability)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
