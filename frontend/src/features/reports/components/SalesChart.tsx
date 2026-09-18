import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/core/utils";

interface SalesChartRow {
  employee_id: number;
  employee_name: string;
  sales: number;
}

const BAR_COLORS = ["var(--warning)", "var(--info)", "var(--primary)"];

function shortName(name: string, max = 14) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * Horizontal bar comparison of top employees by sales.
 * Mirrored for RTL (axis on the right, bars grow leftwards).
 */
export function SalesChart({ rows }: { rows: SalesChartRow[] }) {
  const data = rows.slice(0, 8).map((r) => ({
    name: shortName(r.employee_name),
    fullName: r.employee_name,
    sales: Number(r.sales) || 0,
  }));

  if (!data.length) {
    return (
      <div className="h-[280px] sm:h-[320px] rounded-2xl border border-dashed flex items-center justify-center text-sm font-bold text-muted">
        لا توجد بيانات للعرض البياني
      </div>
    );
  }

  return (
    <div className="h-[280px] sm:h-[320px] min-h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="var(--border)"
            opacity={0.4}
          />
          <XAxis
            type="number"
            reversed
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text-muted)", fontSize: 11, fontWeight: 600 }}
            tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}K`}
          />
          <YAxis
            dataKey="name"
            type="category"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--text)", fontSize: 12, fontWeight: 700 }}
            width={110}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-card)",
              boxShadow: "var(--shadow-premium)",
              fontWeight: 800,
            }}
            formatter={(value) => [formatCurrency(Number(value) || 0), "المبيعات"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
          />
          <Bar dataKey="sales" name="المبيعات" radius={[8, 0, 0, 8]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={BAR_COLORS[i] ?? "var(--primary)"}
                fillOpacity={i < 3 ? 1 : 0.75}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
