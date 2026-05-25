import { useEffect, useState } from "react";
import {
  Scissors,
  CheckCircle2,
  User,
  ChevronLeft,
  Sparkles,
  Zap,
  Timer,
  WalletCards,
  BadgeCheck,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  buildPublicSalonPath,
  buildPublicBookingPath,
  resolvePublicSlug,
} from "../lib/publicSite";

const BOOKING_STEPS = [
  { id: 1, label: "الخدمات", hint: "اختر ما يناسبك من القائمة" },
  { id: 2, label: "الحلاق", hint: "حدد المختص أو اتركه متاحًا" },
  { id: 3, label: "الموعد", hint: "اختر اليوم والوقت المناسبين" },
  { id: 4, label: "البيانات", hint: "أكد معلوماتك قبل الإرسال" },
];

export default function PublicBooking({ embedded = false }) {
  const navigate = useNavigate();
  const { publicSlug } = useParams();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalog, setCatalog] = useState({
    services: [],
    categories: [],
    barbers: [],
    business: {},
  });
  const [bookingData, setBookingData] = useState({
    services: [],
    barber_id: null,
    appointment_date: "",
    appointment_time: "",
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const selectedServices = bookingData.services
    .map((selected) =>
      catalog.services.find((service) => service.id === selected.service_id),
    )
    .filter(Boolean);
  const bookingTotal = selectedServices.reduce(
    (sum, service) => sum + Number(service?.price || 0),
    0,
  );
  const selectedDuration = selectedServices.reduce(
    (sum, service) =>
      sum + Number(service?.duration_minutes || service?.duration || 0),
    0,
  );
  const progressPercentage =
    step >= 5 ? 100 : Math.max(25, (Math.min(step, 4) / 4) * 100);
  const selectedBarber =
    catalog.barbers.find((barber) => barber.id === bookingData.barber_id)
      ?.display_name || "أي حلاق متاح";
  const currentStepMeta =
    BOOKING_STEPS.find((item) => item.id === Math.min(step, 4)) ||
    BOOKING_STEPS[0];

  useEffect(() => {
    fetchCatalog();
  }, []);

  useEffect(() => {
    const business = catalog?.business || {};
    if (!publicSlug || !Object.keys(business).length) return;
    const expectedSlug = resolvePublicSlug(business);
    if (publicSlug !== expectedSlug) {
      navigate(buildPublicBookingPath(business), { replace: true });
    }
  }, [catalog, navigate, publicSlug]);

  async function fetchCatalog() {
    try {
      setLoading(true);
      const res = await api.get("/public/booking-catalog");
      setCatalog(res?.data || {});
    } catch (_error) {
      toast.error("فشل تحميل البيانات، يرجى المحاولة لاحقاً");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlots(date) {
    if (!date) return;
    try {
      setSlotsLoading(true);
      const serviceIds = bookingData.services.map(
        (service) => service.service_id,
      );
      const res = await api.get("/public/time-slots", {
        params: {
          booking_date: date,
          barber_id: bookingData.barber_id,
          service_ids: serviceIds,
        },
      });
      setAvailableSlots(
        res?.data?.available_slots || res?.available_slots || [],
      );
    } catch (_error) {
      toast.error("فشل جلب الأوقات المتاحة");
    } finally {
      setSlotsLoading(false);
    }
  }

  function toggleService(serviceId) {
    setBookingData((prev) => {
      const exists = prev.services.find(
        (service) => service.service_id === serviceId,
      );
      if (exists) {
        return {
          ...prev,
          services: prev.services.filter(
            (service) => service.service_id !== serviceId,
          ),
        };
      }
      return {
        ...prev,
        services: [...prev.services, { service_id: serviceId, quantity: 1 }],
      };
    });
  }

  function handleDateChange(event) {
    const date = event.target.value;
    setBookingData((prev) => ({
      ...prev,
      appointment_date: date,
      appointment_time: "",
    }));
    fetchSlots(date);
  }

  function nextStep() {
    if (step === 1 && bookingData.services.length === 0) {
      toast.error("يرجى اختيار خدمة واحدة على الأقل");
      return;
    }
    if (
      step === 3 &&
      (!bookingData.appointment_date || !bookingData.appointment_time)
    ) {
      toast.error("يرجى اختيار التاريخ والوقت");
      return;
    }
    setStep((current) => current + 1);
  }

  function prevStep() {
    setStep((current) => current - 1);
  }

  async function handleSubmit() {
    if (!bookingData.first_name || !bookingData.phone) {
      toast.error("يرجى إدخال الاسم الأول ورقم الهاتف");
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/public/booking", bookingData);
      setStep(5);
      toast.success("تم تسجيل حجزك بنجاح");
    } catch (error) {
      toast.error(error?.response?.data?.detail || "فشل تسجيل الحجز");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`${embedded ? "min-h-[320px] rounded-[2rem] border border-border bg-card" : "min-h-screen bg-[#f7efe8]"} relative flex items-center justify-center overflow-hidden`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(176,118,45,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(23,17,14,0.10),transparent_30%)]" />
        <div className="relative flex flex-col items-center gap-4 rounded-[2rem] border border-white/70 bg-white/75 px-10 py-8 shadow-soft backdrop-blur-xl">
          <Sparkles className="h-12 w-12 animate-pulse text-accent" />
          <p className="text-sm font-black text-main">
            جاري تجهيز تجربة الحجز...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${embedded ? "rounded-[2.25rem] border border-[#2a1f18]/10 bg-white/90 p-5 shadow-soft backdrop-blur-xl sm:p-8" : "min-h-screen bg-[#f7efe8] px-4 py-16 sm:px-10"} relative overflow-hidden`}
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(176,118,45,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(23,17,14,0.10),transparent_32%)]" />
      <div className="mx-auto max-w-6xl">
        <div className={`space-y-6 ${embedded ? "mb-8" : "mb-12"}`}>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[#17110e] text-amber-300 shadow-2xl shadow-black/15 ring-8 ring-white/65">
              <Scissors size={32} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-accent">
              حجز أونلاين سريع
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-main sm:text-5xl">
              احجز موعدك مع {catalog.business.salon_name}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-bold leading-7 text-muted sm:text-base">
              تجربة حجز مصممة بشكل أوضح: اختر الخدمة، المختص، الموعد، ثم أكد
              بياناتك في أقل من دقيقة.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <InfoTile
              icon={BadgeCheck}
              title="الخدمات المختارة"
              value={`${selectedServices.length}`}
              hint="يمكنك اختيار أكثر من خدمة"
            />
            <InfoTile
              icon={User}
              title="الخبير الحالي"
              value={selectedBarber}
              hint="يمكنك تغييره في الخطوة التالية"
            />
            <InfoTile
              icon={Timer}
              title="المدة التقريبية"
              value={selectedDuration ? `${selectedDuration} دقيقة` : "--"}
              hint="تتغير حسب الخدمات المختارة"
            />
            <InfoTile
              icon={WalletCards}
              title="الإجمالي التقديري"
              value={`${bookingTotal} ${catalog.business.currency || "ج.م"}`}
              hint="السعر النهائي يتأكد بعد تثبيت الطلب"
            />
          </div>
        </div>

        <div className="mb-10 rounded-[2rem] border border-border bg-soft/40 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                الخطوة الحالية
              </p>
              <h3 className="mt-1 text-xl font-black text-main">
                {currentStepMeta.label}
              </h3>
              <p className="mt-1 text-sm font-bold text-muted">
                {currentStepMeta.hint}
              </p>
            </div>
            <div className="rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm font-black text-accent">
              {Math.min(step, 4)} / 4
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            {BOOKING_STEPS.map((item) => (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 transition-all ${
                  step >= item.id
                    ? "border-accent bg-accent/10 shadow-soft"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-black ${
                      step >= item.id
                        ? "bg-accent text-white"
                        : "bg-soft text-muted"
                    }`}
                  >
                    {step > item.id ? <CheckCircle2 size={14} /> : item.id}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {catalog.categories.map((cat) => (
                      <div key={cat.id} className="space-y-4">
                        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent">
                          <Zap size={14} /> {cat.name_ar}
                        </h3>
                        <div className="space-y-3">
                          {catalog.services
                            .filter((service) => service.category_id === cat.id)
                            .map((service) => (
                              <button
                                key={service.id}
                                type="button"
                                onClick={() => toggleService(service.id)}
                                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-right transition-all ${
                                  bookingData.services.find(
                                    (selected) =>
                                      selected.service_id === service.id,
                                  )
                                    ? "border-accent bg-accent-soft shadow-lg shadow-accent/10"
                                    : "border-border bg-card hover:border-accent/40"
                                }`}
                              >
                                <div className="flex items-center gap-4">
                                  <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                      bookingData.services.find(
                                        (selected) =>
                                          selected.service_id === service.id,
                                      )
                                        ? "bg-accent text-white"
                                        : "bg-soft text-muted"
                                    }`}
                                  >
                                    <Scissors size={20} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-main">
                                      {service.name}
                                    </p>
                                    <p className="text-[10px] font-bold text-muted">
                                      {service.duration_minutes} دقيقة
                                    </p>
                                  </div>
                                </div>
                                <div className="text-sm font-black text-accent">
                                  {service.price}{" "}
                                  {catalog.business.currency || "ج.م"}
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-14 gap-2 rounded-xl px-12 text-xs font-black uppercase tracking-widest"
                    >
                      المتابعة لاختيار الحلاق <ChevronLeft size={16} />
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() =>
                        setBookingData({ ...bookingData, barber_id: null })
                      }
                      className={`space-y-4 rounded-[2rem] border p-6 text-center transition-all ${
                        bookingData.barber_id === null
                          ? "border-accent bg-accent-soft shadow-sm"
                          : "border-border bg-card hover:border-accent/40"
                      }`}
                    >
                      <div
                        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                          bookingData.barber_id === null
                            ? "bg-accent text-white"
                            : "bg-soft text-muted"
                        }`}
                      >
                        <User size={32} />
                      </div>
                      <p className="text-sm font-black text-main">
                        أي حلاق متاح
                      </p>
                      <p className="text-[10px] font-bold text-muted">
                        الأسرع دائماً
                      </p>
                    </button>

                    {catalog.barbers.map((barber) => (
                      <button
                        key={barber.id}
                        type="button"
                        onClick={() =>
                          setBookingData({
                            ...bookingData,
                            barber_id: barber.id,
                          })
                        }
                        className={`space-y-4 rounded-[2rem] border p-6 text-center transition-all ${
                          bookingData.barber_id === barber.id
                            ? "border-accent bg-accent-soft shadow-sm"
                            : "border-border bg-card hover:border-accent/40"
                        }`}
                      >
                        <div
                          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
                            bookingData.barber_id === barber.id
                              ? "bg-accent text-white"
                              : "bg-soft text-muted"
                          }`}
                        >
                          <User size={32} />
                        </div>
                        <p className="text-sm font-black text-main">
                          {barber.display_name}
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-14 rounded-xl px-8 text-xs font-black uppercase"
                    >
                      رجوع
                    </Button>
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-14 gap-2 rounded-xl px-12 text-xs font-black uppercase tracking-widest"
                    >
                      اختيار الموعد <ChevronLeft size={16} />
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-[300px_1fr]">
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                        اختر التاريخ
                      </h3>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={bookingData.appointment_date || ""}
                        onChange={handleDateChange}
                        className="h-14 w-full rounded-xl border border-border bg-card px-6 text-sm font-black text-main outline-none focus:border-accent"
                      />
                    </div>
                    <div className="space-y-4">
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                        المواعيد المتاحة
                      </h3>
                      {slotsLoading ? (
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {[1, 2, 3, 4, 5, 6].map((item) => (
                            <div
                              key={item}
                              className="h-12 animate-pulse rounded-lg bg-soft"
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() =>
                                setBookingData({
                                  ...bookingData,
                                  appointment_time: slot,
                                })
                              }
                              className={`h-12 rounded-xl border text-xs font-black transition-all ${
                                bookingData.appointment_time === slot
                                  ? "border-accent bg-accent text-white"
                                  : "border-border bg-card hover:border-accent/40"
                              }`}
                            >
                              {slot}
                            </button>
                          ))}
                          {!bookingData.appointment_date ? (
                            <p className="col-span-full py-8 text-center text-xs font-bold text-muted">
                              يرجى اختيار التاريخ أولاً
                            </p>
                          ) : null}
                          {bookingData.appointment_date &&
                          availableSlots.length === 0 ? (
                            <p className="col-span-full py-8 text-center text-xs font-bold text-danger">
                              عذراً، لا توجد مواعيد متاحة في هذا اليوم
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-14 rounded-xl px-8 text-xs font-black uppercase"
                    >
                      رجوع
                    </Button>
                    <Button
                      disabled={loading}
                      onClick={nextStep}
                      className="h-14 gap-2 rounded-xl px-12 text-xs font-black uppercase tracking-widest"
                    >
                      تأكيد البيانات <ChevronLeft size={16} />
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 4 ? (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <Card className="space-y-8 border-border bg-card p-8 shadow-soft">
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div className="space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                          بياناتك الشخصية
                        </h3>
                        <div className="space-y-4">
                          <Input
                            placeholder="الاسم الأول"
                            value={bookingData.first_name || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                first_name: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-border bg-soft font-bold"
                          />
                          <Input
                            placeholder="اسم العائلة"
                            value={bookingData.last_name || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                last_name: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-border bg-soft font-bold"
                          />
                          <Input
                            placeholder="رقم الهاتف"
                            value={bookingData.phone || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                phone: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-border bg-soft text-left font-bold"
                            dir="ltr"
                          />
                          <Input
                            placeholder="البريد الإلكتروني (اختياري)"
                            value={bookingData.email || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                email: e.target.value,
                              })
                            }
                            className="h-12 rounded-xl border-border bg-soft text-left font-bold"
                            dir="ltr"
                          />
                          <textarea
                            placeholder="ملاحظات إضافية للحجز (اختياري)"
                            value={bookingData.notes || ""}
                            onChange={(e) =>
                              setBookingData({
                                ...bookingData,
                                notes: e.target.value,
                              })
                            }
                            className="min-h-[110px] w-full rounded-xl border border-border bg-soft p-4 text-sm font-bold outline-none transition focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="space-y-4 rounded-3xl border border-border bg-soft/50 p-6">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted">
                          ملخص الحجز
                        </h3>
                        <div className="space-y-3">
                          <SummaryRow
                            label="الخدمات"
                            value={`${bookingData.services.length} خدمات مختارة`}
                          />
                          <SummaryRow
                            label="التاريخ"
                            value={bookingData.appointment_date}
                          />
                          <SummaryRow
                            label="الوقت"
                            value={bookingData.appointment_time}
                          />
                          <SummaryRow label="الحلاق" value={selectedBarber} />
                          <div className="flex items-center justify-between border-t border-border pt-3">
                            <span className="text-[10px] font-black uppercase text-muted">
                              الإجمالي التقديري
                            </span>
                            <span className="text-xl font-black text-main">
                              {bookingTotal} {catalog.business.currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      disabled={loading}
                      onClick={prevStep}
                      className="h-14 rounded-xl px-8 text-xs font-black uppercase"
                    >
                      رجوع
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={submitting || loading}
                      className="h-14 rounded-xl px-16 text-xs font-black uppercase tracking-widest shadow-accent"
                    >
                      {submitting ? "جاري الحجز..." : "تأكيد الحجز النهائي"}
                    </Button>
                  </div>
                </motion.div>
              ) : null}

              {step === 5 ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8 py-12 text-center"
                >
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-success text-white shadow-lg shadow-success/20 animate-bounce">
                    <CheckCircle2 size={48} />
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-main">
                      تم استلام حجزك بنجاح!
                    </h2>
                    <p className="mx-auto max-w-md font-bold text-muted">
                      شكراً لاختيارك {catalog.business.salon_name}. ستصلك رسالة
                      تأكيد على واتساب قريباً.
                    </p>
                  </div>
                  <Card className="mx-auto max-w-xs space-y-4 border-2 border-dashed p-6">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted">الموعد:</span>
                      <span>{bookingData.appointment_date}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted">الساعة:</span>
                      <span>{bookingData.appointment_time}</span>
                    </div>
                  </Card>
                  <Button
                    disabled={loading}
                    onClick={() =>
                      navigate(
                        publicSlug
                          ? buildPublicSalonPath(catalog.business || {})
                          : "/",
                      )
                    }
                    variant="outline"
                    className="h-14 rounded-xl px-12 text-xs font-black uppercase"
                  >
                    العودة للرئيسية
                  </Button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {step < 5 ? (
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <Card className="rounded-[2rem] border-border bg-card p-6 shadow-soft">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                  ملخص حي
                </p>
                <h3 className="mt-2 text-xl font-black text-main">
                  تفاصيل الحجز الحالي
                </h3>

                <div className="mt-5 space-y-4">
                  <SummaryRow
                    label="عدد الخدمات"
                    value={`${selectedServices.length}`}
                  />
                  <SummaryRow label="الحلاق" value={selectedBarber} />
                  <SummaryRow
                    label="التاريخ"
                    value={bookingData.appointment_date || "لم يُحدد بعد"}
                  />
                  <SummaryRow
                    label="الوقت"
                    value={bookingData.appointment_time || "لم يُحدد بعد"}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-accent/15 bg-accent/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">
                    الخدمات المختارة
                  </p>
                  <div className="mt-3 space-y-2">
                    {selectedServices.length ? (
                      selectedServices.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm font-bold"
                        >
                          <span className="truncate text-main">
                            {service.name}
                          </span>
                          <span className="text-accent">
                            {service.price} {catalog.business.currency || "ج.م"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm font-bold text-muted">
                        لم يتم اختيار خدمات بعد
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">
                    الإجمالي
                  </span>
                  <span className="text-2xl font-black text-main">
                    {bookingTotal} {catalog.business.currency || "ج.م"}
                  </span>
                </div>
              </Card>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ title, value, hint, icon: Icon = Sparkles }) {
  return (
    <div className="group rounded-[1.75rem] border border-[#2a1f18]/10 bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">
            {title}
          </p>
          <h3 className="mt-3 line-clamp-2 text-lg font-black text-main">
            {value}
          </h3>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-white">
          <Icon size={20} />
        </div>
      </div>
      <p className="mt-3 text-sm font-bold leading-6 text-muted">{hint}</p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm font-bold">
      <span className="text-muted">{label}</span>
      <span className="text-right text-main">{value}</span>
    </div>
  );
}
