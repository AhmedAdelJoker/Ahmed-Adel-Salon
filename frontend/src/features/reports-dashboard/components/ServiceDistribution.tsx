import type { ComponentProps } from "react";
import { Scissors } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ContentPanel } from "@/components/shared/PremiumUI";
import type { ServiceSlice } from "@/features/reports-dashboard/constants";

const SLICE_COLORS = [
  `var(--primary)`,
  `var(--info)`,
  `var(--warning)`,
  `var(--success)`,
  `var(--danger)`,
  `var(--secondary)`,
];

export interface ServiceDistributionProps {
  serviceDistribution: ServiceSlice[];
  occupancy: number | undefined;
}

export function ServiceDistribution({ serviceDistribution, occupancy }: ServiceDistributionProps) {
  return (
    <ContentPanel className="h-full" title={undefined} subtitle={undefined} actions={undefined}>
      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-4">
        توزيع مبيعات الخدمات
      </h4>
      <div className="relative h-[280px] sm:h-[320px] w-full" dir="ltr">
        {serviceDistribution.length > 0 ? (
          <>
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center">
              <div className="text-3xl sm:text-4xl font-black text-main tracking-tighter tabular-nums">
                {occupancy ?? 72}%
              </div>
              <div className="mt-0.5 text-[8px] font-black uppercase tracking-widest text-muted">
                متوسط الإشغال
              </div>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceDistribution}
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="var(--bg)"
                  strokeWidth={2}
                  label={({ name, percent }) =>
                    typeof percent === "number" && percent > 0.08 ? `${name} ${(percent * 100).toFixed(0)}%` : false
                  }
                  labelLine={true}
                >
                  {serviceDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SLICE_COLORS[index % 6]}
                      stroke="var(--bg)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value + "%", name || "النسبة"]}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--bg-card)",
                    boxShadow: "var(--shadow-premium)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted">
            <PieChart {...({ className: "opacity-20", size: 64 } as unknown as ComponentProps<typeof PieChart>)} />
            <p className="mt-4 text-sm font-bold">لا توجد بيانات خدمات</p>
          </div>
        )}
      </div>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
        {serviceDistribution.map((s, i) => (
          <div
            key={s.name}
            className="flex items-center gap-2 rounded-xl bg-soft/50 p-2.5 border border-border/40 transition-all hover:bg-soft hover:border-accent/30"
          >
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{
                backgroundColor: SLICE_COLORS[i % 6],
              }}
            />
            <span className="text-[10px] font-bold text-main truncate flex-1">{s.name}</span>
            <span className="text-[10px] font-black text-muted tabular-nums">{s.value}%</span>
          </div>
        ))}
        {serviceDistribution.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted">
            <div className="mx-auto mb-3 p-4 rounded-full bg-soft/50 w-20 h-20 flex items-center justify-center">
              <Scissors size={32} className="opacity-30" />
            </div>
            <p className="text-base font-bold text-main">لا توجد بيانات لتوزيع الخدمات</p>
            <p className="text-sm text-muted mt-1">ستظهر البيانات عند إضافة خدمات ومواعيد</p>
          </div>
        )}
      </div>
    </ContentPanel>
  );
}
