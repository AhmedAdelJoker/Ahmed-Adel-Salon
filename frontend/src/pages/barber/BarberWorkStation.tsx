import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { barberService } from "@/services/barberService";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Clock,
  User,
  Scissors,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Timer,
  Star,
  MessageSquare,
  DollarSign,
  Trash2,
  Plus,
  Settings,
  ArrowLeft,
  Zap,
  Target,
  Trophy,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatCurrency } from "@/lib/core/utils";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const BarberWorkStation = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

   
  const [appointment, setAppointment] = useState<any>(null);
   
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [serviceNotes, setServiceNotes] = useState("");
   
  const [productsUsed, setProductsUsed] = useState<any[]>([]);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(true);

   
  const timerRef = useRef<any>(null);

  // Load appointments list for selection
  const fetchAppointments = async () => {
    try {
      const res = await barberService.getQueue();
       
      const data: any = (res as any).data || {};
      const waiting = Array.isArray(data.waiting) ? data.waiting : [];
      const inService = Array.isArray(data.inService) ? data.inService : [];
      setAppointments([...waiting, ...inService]);
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load appointment data
  useEffect(() => {
    setLoading(true);
    fetchAppointments();
    if (appointmentId) {
      loadAppointment();
    } else {
      setLoading(false);
    }
  }, [appointmentId]);

  const loadAppointment = async () => {
    try {
      setLoading(true);
      const res = await barberService.getAppointmentById(appointmentId);
       
      setAppointment((res as any)?.data);
       
      const startedAt = (res as any)?.data?.started_at;
      if (startedAt) {
        const start = new Date(startedAt).getTime();
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setElapsedTime(elapsed);
        setTimerRunning(true);
      }
    } catch (_err) {
      toast.error("فشل تحميل الحجز");
      navigate("/barber");
    } finally {
      setLoading(false);
    }
  };

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev: number) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
      .toString()
      .padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const handleStartTimer = () => {
    if (!appointment.started_at) {
      barberService.updateStatus(appointmentId, "in-service");
      const startTime = new Date().toISOString();
      setAppointment((prev) => ({ ...prev, started_at: startTime }));
      setElapsedTime(0);
    }
    setTimerRunning(true);
  };

  const handlePauseTimer = () => setTimerRunning(false);

  const handleCompleteService = async () => {
    try {
      await barberService.updateStatus(appointmentId, "completed");
      if (tipAmount) {
        await api.post(`/barber/appointments/${appointmentId}/tip`, {
          amount: tipAmount,
        });
      }
      toast.success("تم إنهاء الخدمة بنجاح");
      navigate("/barber");
    } catch (_err) {
      toast.error("فشل إنهاء الخدمة");
    }
  };

  const handleCancelService = async () => {
    try {
      await barberService.updateStatus(appointmentId, "cancelled");
      toast.success("تم إلغاء الخدمة");
      navigate("/barber");
    } catch (_err) {
      toast.error("فشل إلغاء الخدمة");
    }
  };

  const handleAddProduct = () => {
    const name = prompt("اسم المنتج:");
    if (!name) return;
    const price = prompt("السعر:");
    if (!price) return;
    setProductsUsed((prev) => [
      ...prev,
      { name, price: Number(price), id: Date.now() },
    ]);
  };

   
  const totalProducts = productsUsed.reduce((s: number, p: any) => s + p.price, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Scissors size={32} className="text-primary" />
          </div>
          <p className="text-muted font-bold">جاري تحميل محطة العمل...</p>
        </div>
      </div>
    );
  }

  if (!appointment) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin text-primary">
            <Clock size={48} />
          </div>
        </div>
      );
    }
    // Show appointment selection when no appointmentId
    return (
      <div className="min-h-screen bg-slate-50 pb-12" dir="rtl">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-main mb-2">محطة العمل</h1>
            <p className="text-muted">اختر حجزاً لبدء الخدمة</p>
          </div>
          {appointments.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-border shadow-sm">
              <Clock size={48} className="mx-auto mb-4 text-muted" />
              <p className="text-lg font-black text-main mb-2">
                لا توجد مواعيد اليوم
              </p>
              <p className="text-muted mb-6">
                عندما يتم حجز موعد لك، سيظهر هنا
              </p>
              <Button onClick={fetchAppointments} variant="outline">
                <RefreshCw size={14} className="ml-1.5" /> تحديث
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((apt) => (
                <Button
                  key={apt.id}
                  onClick={() => setSearchParams({ appointmentId: apt.id })}
                  className="w-full h-16 rounded-xl bg-white border border-border hover:border-primary hover:shadow-md transition-all text-right px-6 flex items-center gap-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock size={20} />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="font-black text-main">
                      {apt.customer?.name || apt.customer_name || "عميل"}
                    </p>
                    <p className="text-sm text-muted flex items-center gap-2">
                      <Calendar size={14} />
                      {apt.appointment_date
                        ? new Date(apt.appointment_date).toLocaleDateString(
                            "ar-EG",
                            { weekday: "long", day: "numeric", month: "long" },
                          )
                        : ""}
                      •
                      <Clock size={14} />
                      {apt.appointment_time || apt.start_time || ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {apt.status === "waiting"
                        ? "في الانتظار"
                        : apt.status === "in-service"
                          ? "قيد الخدمة"
                          : apt.status}
                    </Badge>
                    <ArrowLeft
                      size={20}
                      className="text-muted hover:text-primary transition-colors"
                    />
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    waiting: "في الانتظار",
    "in-service": "قيد الخدمة",
    completed: "مكتمل",
    ready_for_payment: "جاهز للدفع",
    cancelled: "ملغي",
    pending: "قيد التأكيد",
  };

  const statusColors: Record<string, "warning" | "info" | "success" | "danger" | "secondary"> = {
    waiting: "warning",
    "in-service": "info",
    completed: "success",
    ready_for_payment: "success",
    cancelled: "danger",
    pending: "secondary",
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() => navigate("/barber")}
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-xl font-black text-main">محطة العمل</h1>
                <p className="text-sm text-muted">جلسة خدمة نشطة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={cn(
                  "h-8 px-3 text-xs font-black",
                  statusColors[appointment.status] || "secondary",
                )}
              >
                {statusLabels[appointment.status] || appointment.status}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {/* Timer Card - Full Width */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-6 md:p-8 shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Timer Display */}
            <div className="text-center md:text-left flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                مدة الخدمة
              </p>
              <div className="font-mono text-5xl md:text-7xl font-black text-white tabular-nums tracking-tighter">
                {formatTime(elapsedTime)}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
                {!timerRunning && elapsedTime === 0 ? (
                  <Button
                    size="lg"
                    className="h-14 w-14 rounded-full bg-success text-white shadow-lg"
                    onClick={handleStartTimer}
                  >
                    <Play size={24} />
                  </Button>
                ) : timerRunning ? (
                  <>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-14 w-14 rounded-full border-warning text-warning"
                      onClick={handlePauseTimer}
                    >
                      <Pause size={24} />
                    </Button>
                    <Button
                      size="lg"
                      className="h-14 w-14 rounded-full bg-success text-white shadow-lg"
                      onClick={() => setShowCompleteDialog(true)}
                    >
                      <CheckCircle size={24} />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      className="h-14 w-14 rounded-full bg-primary text-white shadow-lg"
                      onClick={handleStartTimer}
                    >
                      <Play size={24} />
                    </Button>
                    <Button
                      size="lg"
                      className="h-14 w-14 rounded-full bg-success text-white shadow-lg"
                      onClick={() => setShowCompleteDialog(true)}
                    >
                      <CheckCircle size={24} />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Client Info */}
            <div className="md:w-80 flex-shrink-0">
              <div className="bg-white/5 rounded-2xl p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-14 w-14 rounded-xl bg-primary/20 flex items-center justify-center">
                    <User size={24} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-white truncate">
                      {appointment.customer_name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {appointment.service_name}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-300">
                    <MessageSquare size={14} />{" "}
                    {appointment.customer_phone || "---"}
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <DollarSign size={14} />{" "}
                    {appointment.total_amount
                      ? formatCurrency(appointment.total_amount)
                      : "---"}
                  </div>
                  {appointment.notes && (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                        ملاحظات العميل
                      </p>
                      <p className="text-white text-sm">{appointment.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Service Details */}
          <div className="lg:col-span-2 space-y-4">
            {/* Service Steps */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
                <Zap size={16} className="text-primary" /> خطوات الخدمة
              </h3>
              <div className="space-y-3">
                {[
                  { id: 1, label: "استقبال العميل", icon: User },
                  { id: 2, label: "استشارة وتحليل", icon: MessageSquare },
                  { id: 3, label: "تنفيذ الخدمة", icon: Scissors },
                  { id: 4, label: "مراجعة نهائية", icon: CheckCircle },
                  { id: 5, label: "تسليم وإيصال", icon: DollarSign },
                ].map((step, i) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-soft/50 hover:bg-soft transition-colors"
                  >
                    <div
                      className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center",
                        i < 2
                          ? "bg-success/10 text-success"
                          : i === 2
                            ? "bg-primary/10 text-primary"
                            : "bg-soft text-muted",
                      )}
                    >
                      <step.icon size={16} />
                    </div>
                    <span className="text-sm font-black text-main">
                      {step.label}
                    </span>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <CheckCircle size={14} className="text-success" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                <MessageSquare size={16} className="text-info" /> ملاحظات الخدمة
              </h3>
              <Textarea
                value={serviceNotes}
                onChange={(e) => setServiceNotes(e.target.value)}
                placeholder="اكتب ملاحظاتك هنا... (الحساسية، التفضيلات، تعليمات خاصة...)"
                className="h-28 rounded-xl border border-border bg-soft focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Products Used */}
            <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-main flex items-center gap-2">
                  <Star size={16} className="text-warning" /> منتجات مستخدمة
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={handleAddProduct}
                >
                  <Plus size={12} className="ml-1.5" /> إضافة
                </Button>
              </div>
              {productsUsed.length === 0 ? (
                <div className="text-center py-6 text-muted">
                  <Star size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا توجد منتجات مضافة</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {productsUsed.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-3 rounded-xl bg-soft/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-main">
                          {p.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-5 text-[8px] font-black"
                        >
                          {formatCurrency(p.price)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-danger"
                        onClick={() =>
                          setProductsUsed((prev) =>
                            prev.filter((x) => x.id !== p.id),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </Button>
                    </motion.div>
                  ))}
                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-sm font-bold text-muted">
                      إجمالي المنتجات
                    </span>
                    <span className="text-lg font-black text-warning">
                      {formatCurrency(totalProducts)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
              <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                <Target size={16} className="text-primary" /> ملخص سريع
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Timer size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-bold text-main">
                      مدة الخدمة
                    </span>
                  </div>
                  <span className="font-mono text-lg font-black text-primary">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Star size={16} className="text-warning" />
                    </div>
                    <span className="text-sm font-bold text-main">
                      المنتجات
                    </span>
                  </div>
                  <span className="font-mono text-lg font-black text-warning">
                    {formatCurrency(totalProducts)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                      <DollarSign size={16} className="text-success" />
                    </div>
                    <span className="text-sm font-bold text-main">
                      السعر الأساسي
                    </span>
                  </div>
                  <span className="font-mono text-lg font-black text-success">
                    {appointment.total_amount
                      ? formatCurrency(appointment.total_amount)
                      : "---"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
                      <Trophy size={16} className="text-info" />
                    </div>
                    <span className="text-sm font-bold text-main">
                      الإجمالي المتوقع
                    </span>
                  </div>
                  <span className="font-mono text-lg font-black text-info">
                    {formatCurrency(
                      (appointment.total_amount || 0) +
                        totalProducts +
                        (Number(tipAmount) || 0),
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
              <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                <Zap size={16} className="text-accent" /> إجراءات سريعة
              </h3>
              <div className="space-y-2">
                <Button
                  className="w-full h-11 rounded-xl"
                  onClick={() => setShowCompleteDialog(true)}
                >
                  <CheckCircle size={16} className="ml-1.5" /> إنهاء الخدمة
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <XCircle size={16} className="ml-1.5" /> إلغاء الخدمة
                </Button>
              </div>
            </div>

            {/* Settings */}
            <div className="rounded-2xl border border-border bg-white p-4 shadow-soft">
              <h3 className="text-sm font-black text-main mb-3 flex items-center gap-2">
                <Settings size={16} className="text-muted" /> إعدادات المحطة
              </h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-bold text-main">
                    صوت التنبيهات
                  </span>
                  <Switch
                    checked={audioEnabled}
                    onCheckedChange={setAudioEnabled}
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-bold text-main">
                    الاهتزاز عند الانتهاء
                  </span>
                  <Switch defaultChecked />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm font-bold text-main">
                    الحفظ التلقائي للملاحظات
                  </span>
                  <Switch defaultChecked />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle size={18} className="text-success" />
              </div>
              إنهاء الخدمة
            </DialogTitle>
            <DialogDescription>تأكيد إتمام الخدمة للعميل</DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                البشكيرش (اختياري)
              </label>
              <Input
                type="number"
                value={tipAmount}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="0"
                className="h-10 rounded-xl bg-soft border-border font-bold text-center"
              />
            </div>
            <div className="p-3 rounded-xl bg-success/5 border border-success/20">
              <p className="text-sm font-bold text-success flex items-center gap-2">
                <CheckCircle size={14} /> الإجمالي:{" "}
                {formatCurrency(
                  (appointment.total_amount || 0) +
                    totalProducts +
                    (Number(tipAmount) || 0),
                )}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCompleteDialog(false)}
              className="h-10 flex-1 rounded-xl"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleCompleteService}
              className="h-10 flex-1 rounded-xl bg-success"
            >
              تأكيد الإنهاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-danger/10 flex items-center justify-center">
                <XCircle size={18} className="text-danger" />
              </div>
              إلغاء الخدمة
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من إلغاء هذه الخدمة؟ لا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
              className="h-10 flex-1 rounded-xl"
            >
              تراجع
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelService}
              className="h-10 flex-1 rounded-xl"
            >
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BarberWorkStation;
