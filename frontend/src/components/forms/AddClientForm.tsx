import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSalon } from "@/context/SalonContext";
import { notify } from "@/lib/core/toast";
import { UserPlus } from "lucide-react";

const inputClass =
  "input h-12 rounded-2xl bg-soft border-border px-4 font-bold text-main shadow-none focus:border-accent";

export default function AddClientForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t } = useTranslation();
  const { addClient, services = [], barbers = [] } = useSalon();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    employeeId: "",
    serviceId: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      form.name.trim() && form.phone.trim() && form.employeeId && form.serviceId
    );
  }, [form]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!canSubmit) {
      notify.error("من فضلك أكمل كل الحقول المطلوبة");
      return;
    }

    setSubmitting(true);
    try {
      const fullTrimmedName = form.name.trim();

      await addClient({
        first_name: fullTrimmedName,
        last_name: "",
        name: fullTrimmedName,
        phone: form.phone.trim(),
        employee_id: form.employeeId,
        serviceId: form.serviceId,
      });
      notify.success("تم تسجيل العميل وإضافة الجلسة بنجاح");
      setForm({ name: "", phone: "", employeeId: "", serviceId: "" });
      if (onSuccess) onSuccess();
    } catch (err) {
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      notify.error(
        (apiErr?.response?.data?.detail as string) || apiErr?.message || "فشل تسجيل العميل",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card card-gold overflow-hidden rounded-3xl bg-card shadow-soft"
      dir="rtl"
    >
      <div className="card-body space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center border border-border-accent">
            <UserPlus size={22} />
          </div>
          <div>
            <h3 className="text-xl font-black text-main">
              {t("addNewClient") || "إضافة عميل جديد"}
            </h3>
            <p className="text-xs font-bold text-muted">
              سجل العميل واختر الخبير والخدمة في خطوة واحدة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="form-field">
            <label className="label label-required">
              {t("clientName") || "اسم العميل"}
            </label>
            <input
              value={form.name || ""}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t("clientName") || "اسم العميل"}
              className={inputClass}
              autoComplete="name"
            />
          </div>

          <div className="form-field">
            <label className="label label-required">
              {t("phoneNumber") || "رقم الهاتف"}
            </label>
            <input
              value={form.phone || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, phone: e.target.value }))
              }
              placeholder={t("phoneNumber") || "رقم الهاتف"}
              className={`${inputClass} text-left`}
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
            />
          </div>

          <div className="form-field">
            <label className="label label-required">
              {t("selectBarber") || "اختر الحلاق"}
            </label>
            <select
              value={form.employeeId || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, employeeId: e.target.value }))
              }
              className={`${inputClass} select`}
            >
              <option value="">{t("selectBarber") || "اختر الحلاق"}</option>
              {barbers.map((barber) => (
                <option key={barber.id} value={barber.id || ""}>
                  {barber.display_name ||
                    barber.name ||
                    barber.full_name ||
                    `Barber #${barber.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="label label-required">
              {t("selectService") || "اختر الخدمة"}
            </label>
            <select
              value={form.serviceId || ""}
              onChange={(e) =>
                setForm((p) => ({ ...p, serviceId: e.target.value }))
              }
              className={`${inputClass} select`}
            >
              <option value="">{t("selectService") || "اختر الخدمة"}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id || ""}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-2">
          <p className="text-xs font-bold text-muted">
            الحقول المميزة بعلامة * مطلوبة لإضافة الجلسة.
          </p>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            aria-busy={submitting ? "true" : undefined}
            className="btn btn-primary btn-lg rounded-2xl min-w-[180px]"
          >
            {submitting
              ? "جارٍ التسجيل..."
              : t("registerClient") || "تسجيل العميل"}
          </button>
        </div>
      </div>
    </form>
  );
}
