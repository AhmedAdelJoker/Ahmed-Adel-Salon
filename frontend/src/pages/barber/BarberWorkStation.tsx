import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Scissors,
  CheckCircle,
  XCircle,
  Calendar,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import {
  useBarberWorkStation,
  WorkStationHeader,
  TimerCard,
  ServiceDetailsPanel,
  QuickActionsPanel,
} from "@/features/barber-workstation";

const BarberWorkStation = () => {
  const {
    navigate,
    setSearchParams,
    appointmentId,
    appointment,
    appointments,
    loading,
    timerRunning,
    elapsedTime,
    serviceNotes,
    setServiceNotes,
    productsUsed,
    setProductsUsed,
    showCompleteDialog,
    setShowCompleteDialog,
    showCancelDialog,
    setShowCancelDialog,
    tipAmount,
    setTipAmount,
    audioEnabled,
    setAudioEnabled,
    fetchAppointments,
    formatTime,
    handleStartTimer,
    handlePauseTimer,
    handleCompleteService,
    handleCancelService,
    handleAddProduct,
    totalProducts,
    formatCurrency,
  } = useBarberWorkStation();

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
      <div className="min-h-screen bg-slate-50 pb-12">
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
              {appointments.map((apt: any) => (
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

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <WorkStationHeader
        status={appointment.status}
        onBack={() => navigate("/barber")}
      />

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <TimerCard
          elapsedTime={elapsedTime}
          timerRunning={timerRunning}
          formatTime={formatTime}
          formatCurrency={formatCurrency}
          onStartTimer={handleStartTimer}
          onPauseTimer={handlePauseTimer}
          onComplete={() => setShowCompleteDialog(true)}
          appointment={appointment}
        />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ServiceDetailsPanel
            serviceNotes={serviceNotes}
            setServiceNotes={setServiceNotes}
            productsUsed={productsUsed}
            setProductsUsed={setProductsUsed}
            onAddProduct={handleAddProduct}
            totalProducts={totalProducts}
            formatCurrency={formatCurrency}
          />
          <QuickActionsPanel
            elapsedTime={elapsedTime}
            totalProducts={totalProducts}
            appointmentTotalAmount={appointment.total_amount}
            tipAmount={tipAmount}
            formatTime={formatTime}
            formatCurrency={formatCurrency}
            audioEnabled={audioEnabled}
            setAudioEnabled={setAudioEnabled}
            onComplete={() => setShowCompleteDialog(true)}
            onCancel={() => setShowCancelDialog(true)}
          />
        </div>
      </div>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-md rounded-2xl">
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
        <DialogContent className="max-w-md rounded-2xl">
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
