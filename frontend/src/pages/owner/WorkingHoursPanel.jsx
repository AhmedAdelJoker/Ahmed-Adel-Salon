import { useAuth } from "../../context/AuthContext";
import React, { useState, useEffect } from "react";



import {
  Clock,
  CheckCircle2,
  XCircle,
  Save,
  Copy,
  Activity,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { businessSettingsService } from "../../services/businessSettingsService";
import { adaptObject } from "../../services/apiAdapter";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";

const DAYS_AR = {
  saturday: "السبت",
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
};

const ORDER = [
  "saturday",
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

const WorkingHoursPanel = () => {
  const [hours, setWorkingHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {

    const fetchHours = async () => {
      try {
        setLoading(true);
        const settings = await businessSettingsService.get();
        setWorkingHours(settings.workingHours || {});
      } catch (err) {
        toast.error("فشل تحميل ساعات العمل");
      } finally {
        setLoading(false);
      }
    };
    fetchHours();
  }, []);

  const handleToggle = (day) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        is_open: !prev[day].is_open,
        open_time: prev[day].is_open ? null : prev[day].open_time || "10:00",
        close_time: prev[day].is_open ? null : prev[day].close_time || "22:00",
      },
    }));
  };

  const handleChange = (day, field, value) => {
    setWorkingHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const applyToAll = () => {
    const sat = hours?.saturday;
    if (!sat) return;
    const newHours = {};
    ORDER.forEach((day) => {
      newHours[day] = { ...sat };
    });
    setWorkingHours(newHours);
    toast.success("تم تطبيق مواعيد السبت على جميع الأيام");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await businessSettingsService.update({ workingHours: hours });
      toast.success("تم حفظ ساعات العمل بنجاح");
    } catch (err) {
      toast.error("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Activity className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري جلب جدول المواعيد...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-main flex items-center gap-2">
            <Clock size={18} className="text-accent" /> تحديد ساعات العمل
            الإستراتيجية
          </h3>
          <p className="text-[10px] font-bold text-muted mt-1 uppercase tracking-wider">
            ضبط أوقات التشغيل والراحة لضمان كفاءة الحجوزات
          </p>
        </div>
        <Button
          variant="outline"
          disabled={loading}
          onClick={applyToAll}
          className="h-10 rounded-xl font-black text-[10px] uppercase border-border bg-card hover:bg-soft"
        >
          <Copy size={14} className="ml-2" /> تطبيق السبت على الكل
        </Button>
      </div>

      <Card className="rounded-[26px] border border-border bg-card shadow-soft overflow-hidden">
        <div className="divide-y divide-border">
          {ORDER.map((day) => {
            const config = (hours || {})[day] || {
              is_open: false,
              open_time: null,
              close_time: null,
            };
            return (
              <div
                key={day}
                className={`p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-colors ${config.is_open ? "bg-card" : "bg-soft/30"}`}
              >
                <div className="flex items-center gap-6 min-w-[150px]">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm border ${config.is_open ? "bg-accent text-white border-accent" : "bg-soft text-muted border-border opacity-50"}`}
                  >
                    {DAYS_AR[day].charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-black text-main">
                      {DAYS_AR[day]}
                    </div>
                    <div className="text-[9px] font-bold text-muted uppercase tracking-widest mt-0.5">
                      {config.is_open ? "يوم عمل تشغيلي" : "عطلة أسبوعية"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 items-center justify-end gap-10">
                  {config.is_open && (
                    <div className="flex items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted uppercase tracking-widest mr-1">
                          الفتح
                        </label>
                        <Input
                          type="time"
                          className="h-10 rounded-lg bg-soft border-border font-black text-xs w-32"
                          value={config.open_time ?? ""}
                          onChange={(e) =>
                            handleChange(day, "open_time", e.target.value)
                          }
                        />
                      </div>
                      <div className="text-muted mt-5 font-bold">إلى</div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-muted uppercase tracking-widest mr-1">
                          الإغلاق
                        </label>
                        <Input
                          type="time"
                          className="h-10 rounded-lg bg-soft border-border font-black text-xs w-32"
                          value={config.close_time ?? ""}
                          onChange={(e) =>
                            handleChange(day, "close_time", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pr-6 border-r border-border">
                    <span
                      className={`text-[10px] font-black uppercase ${config.is_open ? "text-accent" : "text-muted"}`}
                    >
                      {config.is_open ? "مفتوح" : "مغلق"}
                    </span>
                    <Switch
                      checked={config.is_open}
                      onCheckedChange={() => handleToggle(day)}
                      className="data-[state=checked]:bg-accent"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end pt-4">
        <Button
          disabled={loading}
          onClick={handleSave}
          disabled={saving}
          variant="accent"
          className="px-16 h-14 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] shadow-soft hover:-translate-y-0.5 transition-all"
        >
          {saving ? "جاري الحفظ..." : "تأكيد بروتوكول التشغيل"}{" "}
          <Save className="mr-2" size={16} />
        </Button>
      </div>
    </div>
  );
};

export default WorkingHoursPanel;

