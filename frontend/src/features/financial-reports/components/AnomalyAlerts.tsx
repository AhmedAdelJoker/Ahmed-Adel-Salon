import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import type { DayAnomaly } from "@/lib/money/financialAnalytics";

export interface AnomalyAlertsProps {
  anomalies: DayAnomaly[];
  onInspectDay: (date: string) => void;
}

export function AnomalyAlerts({ anomalies, onInspectDay }: AnomalyAlertsProps) {
  if (anomalies.length === 0) return null;
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-amber-500/15 p-2 text-amber-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <CardTitle>تنبيهات الشذوذ الإحصائي</CardTitle>
            <CardDescription>
              أيام خارج النمط المعتاد (انحراف ±2σ أو قفزة 3 أضعاف الوسيط) — راجعها قبل اعتماد التقرير
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 sm:p-6">
        {anomalies.slice(0, 4).map((a) => (
          <div
            key={`${a.date}-${a.kind}`}
            className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-card p-3"
          >
            <AlertTriangle
              size={16}
              className={cn("mt-0.5 shrink-0", a.severity === "high" ? "text-rose-600" : "text-amber-600")}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-main">{a.message}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[9px]">
                  {a.kind === "rev_spike" ? "قفزة إيرادات" : a.kind === "exp_spike" ? "قفزة مصروفات" : "هبوط الصافي"}
                </Badge>
                {a.severity === "high" && (
                  <Badge className="bg-rose-600 text-[9px] text-white">حرج</Badge>
                )}
                <button
                  type="button"
                  onClick={() => onInspectDay(a.date)}
                  className="text-[10px] font-black text-primary hover:underline"
                >
                  فحص اليوم ←
                </button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
