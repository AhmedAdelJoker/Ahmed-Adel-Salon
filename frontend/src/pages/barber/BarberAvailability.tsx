import { useAuth } from "@/context/AuthContext";
import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Sun,
  Moon,
  Star,
  Shield,
  Save,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import api from "@/services/api";
import { PageHeader } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DAYS_AR = [
  { key: "sunday", label: "الأحد", short: "أحد" },
  { key: "monday", label: "الإثنين", short: "إثنين" },
  { key: "tuesday", label: "الثلاثاء", short: "ثلاثاء" },
  { key: "wednesday", label: "الأربعاء", short: "أربعاء" },
  { key: "thursday", label: "الخميس", short: "خميس" },
  { key: "friday", label: "الجمعة", short: "جمعة" },
  { key: "saturday", label: "السبت", short: "سبت" },
];

const BarberAvailability = () => {
  const { user } = useAuth();
   
  const [workingHours, setWorkingHours] = useState<Record<string, any>>({});
   
  const [timeOff, setTimeOff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showTimeOffModal, setShowTimeOffModal] = useState(false);
   
  const [editingTimeOff, setEditingTimeOff] = useState<any>(null);
  const [timeOffForm, setTimeOffForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
    type: "vacation",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [hoursRes, timeOffRes] = await Promise.all([
        api.get("/barber/working-hours"),
        api.get("/barber/time-off"),
      ]);
      setWorkingHours(hoursRes.data?.working_hours || {});
      setTimeOff(timeOffRes.data || []);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDayChange = (day: string, field: string, value: unknown) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleSaveHours = async () => {
    try {
      setSaving(true);
      await api.post("/barber/working-hours", { working_hours: workingHours });
      fetchData();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimeOff = async () => {
    try {
      if (editingTimeOff) {
        await api.put(`/barber/time-off/${editingTimeOff.id}`, timeOffForm);
      } else {
        await api.post("/barber/time-off", timeOffForm);
      }
      setShowTimeOffModal(false);
      setTimeOffForm({
        start_date: "",
        end_date: "",
        reason: "",
        type: "vacation",
      });
      setEditingTimeOff(null);
      fetchData();
    } catch (err) {
      console.error("Time off error:", err);
    }
  };

  const handleDeleteTimeOff = async (id: string | number) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    try {
      await api.delete(`/barber/time-off/${id}`);
      fetchData();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

   
  const handleEditTimeOff = (item: any) => {
    setEditingTimeOff(item);
    setTimeOffForm({
      start_date: item.start_date,
      end_date: item.end_date,
      reason: item.reason,
      type: item.type || "vacation",
    });
    setShowTimeOffModal(true);
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto max-w-7xl space-y-4 px-3 pt-4 sm:space-y-5 sm:px-4 lg:px-6">
        <PageHeader
          title="ساعات العمل والإجازات"
          subtitle="إدارة جدول عملك وإجازاتك"
          badge="الجدولة"
          icon={Calendar}
          className={undefined}
          actions={
            <Button
              className="h-10 rounded-xl px-4"
              onClick={handleSaveHours}
              loading={saving}
            >
              <Save size={14} className="ml-1.5" /> حفظ التغييرات
            </Button>
          }
        />

        {/* Working Hours */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-black text-main flex items-center gap-2">
              <Sun size={16} className="text-warning" /> ساعات العمل الأسبوعية
            </h3>
            <Badge className="h-6 px-3 text-[9px] font-black" variant="outline">
              يتكرر أسبوعياً
            </Badge>
          </div>

          <div className="space-y-3">
            {DAYS_AR.map((day) => {
              const hours = workingHours[day.key] || {
                is_open: true,
                open_time: "09:00",
                close_time: "22:00",
              };
              return (
                <motion.div
                  key={day.key}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: DAYS_AR.indexOf(day) * 0.03 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-soft/50 hover:bg-soft transition-colors"
                >
                  <div className="w-20 text-right">
                    <span className="text-xs font-black text-main">
                      {day.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-bold text-muted">
                        مفتوح
                      </Label>
                      <Switch
                        checked={hours.is_open !== false}
                        onCheckedChange={(checked) =>
                          handleDayChange(day.key, "is_open", checked)
                        }
                        disabled={!hours.is_open}
                      />
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1",
                        hours.is_open === false && "opacity-50",
                      )}
                    >
                      <Label className="text-xs font-bold text-muted">من</Label>
                      <Input
                        type="time"
                        value={hours.open_time}
                        onChange={(e) =>
                          handleDayChange(day.key, "open_time", e.target.value)
                        }
                        className="h-8 w-24 text-xs font-bold"
                        disabled={hours.is_open === false}
                      />
                      <Label className="text-xs font-bold text-muted">
                        إلى
                      </Label>
                      <Input
                        type="time"
                        value={hours.close_time}
                        onChange={(e) =>
                          handleDayChange(day.key, "close_time", e.target.value)
                        }
                        className="h-8 w-24 text-xs font-bold"
                        disabled={hours.is_open === false}
                      />
                    </div>
                    {hours.is_open === false && (
                      <Badge
                        variant="secondary"
                        className="h-5 text-[8px] font-black"
                      >
                        عطلة
                      </Badge>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Time Off */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-black text-main flex items-center gap-2">
              <Moon size={16} className="text-info" /> الإجازات والراحات
            </h3>
            <Button
              className="h-9 rounded-xl px-3 text-xs"
              onClick={() => {
                setTimeOffForm({
                  start_date: today,
                  end_date: today,
                  reason: "",
                  type: "vacation",
                });
                setEditingTimeOff(null);
                setShowTimeOffModal(true);
              }}
            >
              <Plus size={14} className="ml-1.5" /> إضافة إجازة
            </Button>
          </div>

          {timeOff.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Star size={40} className="mb-3 text-muted" />
              <p className="text-base font-black text-main">
                لا توجد إجازات مجدولة
              </p>
              <p className="mt-1 text-xs font-bold text-muted">
                يمكنك إضافة إجازات مستقبلية
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {timeOff.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-3 rounded-xl border border-border bg-soft/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center",
                        item.type === "vacation"
                          ? "bg-warning/10 text-warning"
                          : "bg-info/10 text-info",
                      )}
                    >
                      {item.type === "vacation" ? (
                        <Sun size={18} />
                      ) : (
                        <Shield size={18} />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-black text-main">
                        {item.reason ||
                          (item.type === "vacation" ? "إجازة" : "راحة")}
                      </p>
                      <p className="text-[10px] font-bold text-muted">
                        {new Date(item.start_date).toLocaleDateString("ar-EG", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                        {item.end_date !== item.start_date &&
                          ` - ${new Date(item.end_date).toLocaleDateString("ar-EG", { day: "numeric", month: "long" })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="h-5 text-[8px] font-black"
                    >
                      {item.type === "vacation" ? "إجازة" : "راحة"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEditTimeOff(item)}
                    >
                      <Edit2 size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-danger"
                      onClick={() => handleDeleteTimeOff(item.id)}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Time Off Modal */}
      <Dialog open={showTimeOffModal} onOpenChange={setShowTimeOffModal}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTimeOff ? "تعديل إجازة" : "إضافة إجازة جديدة"}
            </DialogTitle>
            <DialogDescription>حدد فترة الإجازة والسبب</DialogDescription>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                النوع
              </label>
              <Select
                value={timeOffForm.type}
                onValueChange={(v) =>
                  setTimeOffForm({ ...timeOffForm, type: v })
                }
              >
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">إجازة</SelectItem>
                  <SelectItem value="break">راحة</SelectItem>
                  <SelectItem value="sick">إجازة مرضية</SelectItem>
                  <SelectItem value="other">أخرى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  من تاريخ
                </label>
                <Input
                  type="date"
                  value={timeOffForm.start_date}
                  onChange={(e) =>
                    setTimeOffForm({
                      ...timeOffForm,
                      start_date: e.target.value,
                    })
                  }
                  className="h-10 rounded-xl"
                  min={today}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  إلى تاريخ
                </label>
                <Input
                  type="date"
                  value={timeOffForm.end_date}
                  onChange={(e) =>
                    setTimeOffForm({ ...timeOffForm, end_date: e.target.value })
                  }
                  className="h-10 rounded-xl"
                  min={timeOffForm.start_date || today}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                السبب
              </label>
              <Input
                value={timeOffForm.reason}
                onChange={(e) =>
                  setTimeOffForm({ ...timeOffForm, reason: e.target.value })
                }
                className="h-10 rounded-xl"
                placeholder="مثال: إجازة سنوية، مرض، سفر..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowTimeOffModal(false);
                setTimeOffForm({
                  start_date: "",
                  end_date: "",
                  reason: "",
                  type: "vacation",
                });
                setEditingTimeOff(null);
              }}
            >
              إلغاء
            </Button>
            <Button onClick={handleAddTimeOff} className="h-10 rounded-xl">
              {editingTimeOff ? "حفظ" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BarberAvailability;
