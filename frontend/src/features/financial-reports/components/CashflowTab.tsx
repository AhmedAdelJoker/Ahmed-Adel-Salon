import { Activity, History, PieChart as PieChartIcon } from "lucide-react";



import {



  Area,



  CartesianGrid,



  Cell,



  ComposedChart,



  Line,



  Pie,



  PieChart,



  ResponsiveContainer,



  Tooltip as ReTooltip,



  XAxis,



  YAxis,



} from "recharts";



import { Badge } from "@/components/ui/badge";



import { Switch } from "@/components/ui/switch";



import { cn, formatCurrency } from "@/lib/core/utils";



import { useTranslation } from "react-i18next";



import { ChartCard } from "@/components/shared/DisplayComponents";



import { FinanceTooltip } from "@/features/financial-reports";



import { compactTick } from "@/features/financial-reports/utils";



import type { FinancialsState, TrendPoint } from "@/types/reports";



import type { SelectedPayment } from "@/features/financial-reports";







export interface CashflowTabProps {



  financials: FinancialsState;



  paymentsWithPct: Array<{ name: string; value: number; pct: number; color: string; label: string }>;



  selectedPayment: SelectedPayment | null;



  showPrev: boolean;



  setShowPrev: (v: boolean) => void;



  setSelectedDay: (v: TrendPoint | null) => void;



  setSelectedExpenseCategory: (v: import("@/types/reports").ExpenseSlice | null) => void;



  setSelectedPayment: (v: SelectedPayment | null) => void;



}







export function CashflowTab({
  financials,



  paymentsWithPct,



  selectedPayment,



  showPrev,



  setShowPrev,



  setSelectedDay,



  setSelectedExpenseCategory,



  setSelectedPayment,



}: CashflowTabProps) {

  const { t } = useTranslation("owner");



  return (



    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">



      <ChartCard



        title={



          <span className="flex items-center gap-2">



            <Activity size={16} className="text-primary" /> {t("finFeat.cashflow.title")}



          </span>



        }



        subtitle={t("finFeat.cashflow.subtitle", { count: financials.dailyTrends.length })}



        data={financials.dailyTrends}



        height={320}



        emptyTitle={t("finFeat.cashflow.emptyTitle")}



        emptyHint={t("finFeat.cashflow.emptyHint")}



        className="overflow-hidden lg:col-span-2"



        actions={



          financials.prevDailyTrends.length > 0 ? (



            <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-soft/60 px-2.5 py-1.5 text-[10px] font-black text-muted">



              <History size={12} />



              <Switch checked={showPrev} onCheckedChange={setShowPrev} aria-label={t("finFeat.cashflow.prevToggle")} />



              {t("finFeat.cashflow.prevLabel")}



            </label>



          ) : undefined



        }



        badge={



          <div className="flex flex-wrap items-center gap-1.5">



            <Badge variant="outline" className="gap-1.5">



              <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t("finFeat.cashflow.revenue")}



            </Badge>



            <Badge variant="outline" className="gap-1.5">



              <span className="h-2 w-2 rounded-full bg-rose-500" /> {t("finFeat.cashflow.expenses")}



            </Badge>



          </div>



        }



      >



        <div className="h-[300px] w-full sm:h-[320px]" dir="ltr">



          <ResponsiveContainer width="100%" height="100%">



            <ComposedChart data={financials.dailyTrends} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>



              <defs>



                <linearGradient id="finRev" x1="0" y1="0" x2="0" y2="1">



                  <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.28} />



                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />



                </linearGradient>



                <linearGradient id="finExp" x1="0" y1="0" x2="0" y2="1">



                  <stop offset="5%" stopColor="var(--chart-7)" stopOpacity={0.28} />



                  <stop offset="95%" stopColor="var(--chart-7)" stopOpacity={0} />



                </linearGradient>



              </defs>



              <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--border)" opacity={0.5} />



              <XAxis



                dataKey="label"



                axisLine={false}



                tickLine={false}



                minTickGap={24}



                tick={{ fontSize: 10, fontWeight: 800, fill: "var(--text-muted)" }}



                dy={8}



              />



              <YAxis



                axisLine={false}



                tickLine={false}



                width={56}



                tickFormatter={compactTick}



                tick={{ fontSize: 10, fontWeight: 800, fill: "var(--text-muted)" }}



              />



              <ReTooltip content={<FinanceTooltip />} cursor={{ stroke: "var(--border)" }} />



              {showPrev && financials.prevDailyTrends.length > 0 && (



                <>



                  <Line



                    type="monotone"



                    data={financials.prevDailyTrends}



                    dataKey="rev"



                    name={t("finFeat.cashflow.prevRevenue")}



                    stroke="var(--chart-3)"



                    strokeWidth={1.5}



                    strokeDasharray="6 4"



                    strokeOpacity={0.6}



                    dot={false}



                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--chart-3)", fill: "var(--bg-card)", strokeOpacity: 0.6 }}



                  />



                  <Line



                    type="monotone"



                    data={financials.prevDailyTrends}



                    dataKey="exp"



                    name={t("finFeat.cashflow.prevExpenses")}



                    stroke="var(--chart-7)"



                    strokeWidth={1.5}



                    strokeDasharray="6 4"



                    strokeOpacity={0.6}



                    dot={false}



                    activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--chart-7)", fill: "var(--bg-card)", strokeOpacity: 0.6 }}



                  />



                </>



              )}



              <Area



                type="monotone"



                dataKey="rev"



                name={t("finFeat.cashflow.revenue")}



                stroke="var(--chart-3)"



                strokeWidth={2.5}



                fill="url(#finRev)"



                dot={false}



                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-3)", fill: "var(--bg-card)" }}



              />



              <Area



                type="monotone"



                dataKey="exp"



                name={t("finFeat.cashflow.expenses")}



                stroke="var(--chart-7)"



                strokeWidth={2.5}



                fill="url(#finExp)"



                dot={false}



                activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--chart-7)", fill: "var(--bg-card)" }}



              />



            </ComposedChart>



          </ResponsiveContainer>



        </div>



      </ChartCard>







      <ChartCard



        title={



          <span className="flex items-center gap-2">



            <PieChartIcon size={16} className="text-amber-600" /> {t("finFeat.cashflow.paymentsTitle")}



          </span>



        }



        subtitle={t("finFeat.cashflow.paymentsSubtitle")}



        data={paymentsWithPct}



        height={300}



        emptyTitle={t("finFeat.cashflow.paymentsEmptyTitle")}



        emptyHint={t("finFeat.cashflow.paymentsEmptyHint")}



        className="overflow-hidden"



      >



        <div className="relative mx-auto h-[200px] w-full" dir="ltr">



          <ResponsiveContainer width="100%" height="100%">



            <PieChart>



              <Pie



                data={paymentsWithPct}



                innerRadius="62%"



                outerRadius="88%"



                paddingAngle={4}



                dataKey="value"



                nameKey="label"



                strokeWidth={0}



              >



                {paymentsWithPct.map((p) => (



                  <Cell



                    key={p.name}



                    fill={p.color}



                    onClick={() => {



                      setSelectedDay(null);



                      setSelectedExpenseCategory(null);



                      setSelectedPayment({ name: p.name, value: p.value });



                    }}



                    style={{ cursor: "pointer", outline: "none" }}



                    opacity={selectedPayment && selectedPayment.name !== p.name ? 0.45 : 1}



                  />



                ))}



              </Pie>



              <ReTooltip content={<FinanceTooltip />} />



            </PieChart>



          </ResponsiveContainer>



          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">



            <span className="text-[10px] font-black uppercase tracking-widest text-muted">{t("finFeat.cashflow.totalLabel")}</span>



            <span className="max-w-[160px] truncate text-lg font-black tabular-nums text-main">



              {formatCurrency(financials.revenue)}



            </span>



          </div>



        </div>



        <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto">



          {paymentsWithPct.map((p) => (



            <button



              key={p.name}



              type="button"



              onClick={() => {



                setSelectedDay(null);



                setSelectedExpenseCategory(null);



                setSelectedPayment(



                  selectedPayment?.name === p.name ? null : { name: p.name, value: p.value },



                );



              }}



              aria-pressed={selectedPayment?.name === p.name}



              className={cn(



                "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",



                selectedPayment?.name === p.name



                  ? "border-primary bg-primary/5"



                  : "border-border/50 bg-soft/60 hover:bg-soft",



              )}



            >



              <span className="flex min-w-0 items-center gap-2">



                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />



                <span className="truncate text-xs font-black text-main">{p.label}</span>



                <span className="shrink-0 text-[10px] font-black tabular-nums text-muted">



                  {p.pct.toFixed(0)}%



                </span>



              </span>



              <span className="shrink-0 text-xs font-black tabular-nums text-main">



                {formatCurrency(p.value)}



              </span>



            </button>



          ))}



        </div>



      </ChartCard>



    </div>



  );



}



