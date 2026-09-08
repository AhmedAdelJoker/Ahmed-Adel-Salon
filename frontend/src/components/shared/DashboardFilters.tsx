import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const inputClass =
  "premium-control-surface h-12 rounded-2xl border border-border px-4 font-bold text-main";
const selectClass = `${inputClass} premium-native-select`;

export interface DashboardFiltersState {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  serviceId?: string | number;
  barberId?: string | number;
  [key: string]: unknown;
}

export interface DashboardFiltersProps {
  filters?: DashboardFiltersState;
  setFilters?: React.Dispatch<React.SetStateAction<DashboardFiltersState>>;
  services?: { id?: string | number; name?: string; name_ar?: string; [key: string]: unknown }[];
  barbers?: { id?: string | number; display_name?: string; name?: string; full_name?: string; [key: string]: unknown }[];
  onApply?: () => void;
  onReset?: () => void;
}

// 1. أضفنا قيمة افتراضية لـ filters = {} لضمان عدم حدوث undefined
export default function DashboardFilters({
  filters = {},
  setFilters,
  services = [],
  barbers = [],
  onApply,
  onReset,
}: DashboardFiltersProps) {
  const { loading } = useAuth();

  return (
    <section
      className="card premium-filter-shell rounded-3xl border border-border shadow-soft p-5 sm:p-6"
      dir="rtl"
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-main">فلاتر Dashboard</h3>
          <p className="text-xs font-bold text-muted">
            حدد الفترة والخدمة والحلاق وطريقة الدفع لعرض البيانات المطلوبة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="form-field">
          <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            من تاريخ
          </label>
          {/* 2. استخدمنا ?. لقراءة آمنة */}
          <Input
            type="date"
            value={filters?.startDate || ""}
            onChange={(e) =>
              setFilters?.((p) => ({ ...p, startDate: e.target.value }))
            }
            className={inputClass}
          />
        </div>

        <div className="form-field">
          <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            إلى تاريخ
          </label>
          <Input
            type="date"
            value={filters?.endDate || ""}
            onChange={(e) =>
              setFilters?.((p) => ({ ...p, endDate: e.target.value }))
            }
            className={inputClass}
          />
        </div>

        <div className="form-field">
          <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            طريقة الدفع
          </label>
          <select
            value={filters?.paymentMethod || ""}
            onChange={(e) =>
              setFilters?.((p) => ({ ...p, paymentMethod: e.target.value }))
            }
            className={selectClass}
          >
            <option value="">كل طرق الدفع</option>
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
            <option value="wallet">محفظة</option>
          </select>
        </div>

        <div className="form-field">
          <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            الخدمة
          </label>
          <select
            value={filters?.serviceId || ""}
            onChange={(e) =>
              setFilters?.((p) => ({ ...p, serviceId: e.target.value }))
            }
            className={selectClass}
          >
            <option value="">كل الخدمات</option>
            {services.map((service) => (
              <option key={service.id} value={service.id || ""}>
                {service.name || service.name_ar || `خدمة #${service.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-muted">
            الحلاق
          </label>
          <select
            value={filters?.barberId || ""}
            onChange={(e) =>
              setFilters?.((p) => ({ ...p, barberId: e.target.value }))
            }
            className={selectClass}
          >
            <option value="">كل الحلاقين</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id || ""}>
                {barber.display_name ||
                  barber.name ||
                  barber.full_name ||
                  `حلاق #${barber.id}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-3 sm:justify-end">
        <Button
          variant="secondary"
          disabled={loading}
          onClick={onReset}
          className="sm:min-w-[9rem]"
        >
          إعادة تعيين
        </Button>
        <Button
          disabled={loading}
          onClick={onApply}
          className="sm:min-w-[9rem]"
        >
          تطبيق الفلاتر
        </Button>
      </div>
    </section>
  );
}
