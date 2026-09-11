import { useAuth } from "@/context/AuthContext";
import {
  UserPlus,
  CalendarPlus,
  Wallet,
  Scissors,
  FileBarChart2,
  Bell,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const actions = [
  {
    title: "إضافة عميل",
    subtitle: "إضافة عميل جديد بسرعة",
    icon: UserPlus,
    path: "/customers",
    accent: "text-info bg-info-bg border-info-border",
  },
  {
    title: "بدء جلسة",
    subtitle: "متابعة الدور الحالي",
    icon: CalendarPlus,
    path: "/reception-board",
    accent: "text-accent bg-accent-soft border-border-accent",
  },
  {
    title: "المحاسبة",
    subtitle: "إصدار فاتورة / سداد",
    icon: Wallet,
    path: "/pos",
    accent: "text-success bg-success-bg border-success-border",
  },
  {
    title: "الحلاقون",
    subtitle: "مراجعة الأداء",
    icon: Scissors,
    path: "/owner/hr",
    accent: "text-warning bg-warning-bg border-warning-border",
  },
  {
    title: "التقارير",
    subtitle: "تحليل الأداء والإيرادات",
    icon: FileBarChart2,
    path: "/owner/financial",
    accent: "text-info bg-info-bg border-info-border",
  },
  {
    title: "الإشعارات",
    subtitle: "متابعة آخر التنبيهات",
    icon: Bell,
    path: "/activity-logs",
    accent: "text-danger bg-danger-bg border-danger-border",
  },
];

export default function QuickActionsPanel({ className = "" }) {
  const { loading } = useAuth();
  const navigate = useNavigate();

  return (
    <section
      className={`card rounded-3xl border border-border bg-card p-5 shadow-soft ${className}`}
      dir="rtl"
    >
      <div className="mb-5 flex flex-col gap-1">
        <h3 className="text-lg font-black tracking-tight text-main">
          إجراءات سريعة
        </h3>
        <p className="text-xs font-bold leading-relaxed text-muted">
          أهم العمليات اليومية في مكان واحد
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.title}
              type="button"
              disabled={loading}
              onClick={() => navigate(action.path)}
              className="group rounded-3xl border border-border bg-soft/60 p-4 text-right transition-all hover:-translate-y-0.5 hover:border-border-accent hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 rounded-2xl border p-3 transition-transform group-hover:scale-105 ${action.accent}`}
                >
                  <Icon size={20} />
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-black text-main">
                    {action.title}
                  </div>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-muted">
                    {action.subtitle}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
