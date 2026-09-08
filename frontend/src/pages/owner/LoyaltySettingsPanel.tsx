import React, { useState, useEffect } from "react";
import {
  Trophy,
  Plus,
  Trash2,
  Percent,
  Star,
  Zap,
  Target,
  Gift,
  ShieldCheck,
  Save,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";

import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/core/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const DEFAULT_LOYALTY_SETTINGS = {
  enabled: false,
  points_per_egp: 0.1, // 10 EGP = 1 point
  redemption_rate: 0.5, // 1 point = 0.5 EGP
  tiers: [
    {
      name: "برونزي",
      min_visits: 0,
      discount_percent: 0,
      color: "bg-orange-600",
    },
    { name: "فضي", min_visits: 6, discount_percent: 5, color: "bg-slate-400" },
    {
      name: "ذهبي",
      min_visits: 16,
      discount_percent: 10,
      color: "bg-amber-400",
    },
  ],
  milestones: [
    { visits: 5, discount_percent: 50, label: "مكافأة الزيارة الخامسة" },
  ],
};

export default function LoyaltySettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_LOYALTY_SETTINGS);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      const res = await api.get("/business-settings");
      const data = res.data || res;
      if (data.loyalty_settings || data.loyaltySettings) {
        setSettings({
          ...DEFAULT_LOYALTY_SETTINGS,
          ...(data.loyalty_settings || data.loyaltySettings),
        });
      }
    } catch (error) {
      console.error("Fetch loyalty settings error:", error);
      toast.error("فشل تحميل إعدادات الولاء");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      await api.put("/business-settings", {
        loyaltySettings: settings,
      });
      toast.success("تم حفظ إعدادات نظام الولاء بنجاح");
    } catch (error) {
      console.error("Save loyalty settings error:", error);
      toast.error("فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  const updateTier = (index, field, value) => {
    const newTiers = [...settings.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    setSettings({ ...settings, tiers: newTiers });
  };

  const addTier = () => {
    setSettings({
      ...settings,
      tiers: [
        ...settings.tiers,
        {
          name: "مستوى جديد",
          min_visits: 20,
          discount_percent: 15,
          color: "bg-blue-500",
        },
      ],
    });
  };

  const removeTier = (index) => {
    const newTiers = settings.tiers.filter((_, i) => i !== index);
    setSettings({ ...settings, tiers: newTiers });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div
      className="space-y-8 animate-in fade-in slide-in-from-bottom-4"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-main flex items-center gap-3">
            <Trophy className="text-amber-500" size={28} /> نظام الولاء
            والمكافآت الذكي
          </h2>
          <p className="text-sm text-muted font-medium mt-1 uppercase tracking-wider">
            قم بتهيئة مستويات العملاء وقواعد اكتساب النقاط التلقائية
          </p>
        </div>
        <div className="flex items-center gap-3 bg-soft p-2 rounded-2xl border border-border/50">
          <span className="text-xs font-black px-3">حالة النظام:</span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(val) =>
              setSettings({ ...settings, enabled: val })
            }
          />
          <Badge
            variant={settings.enabled ? "success" : "secondary"}
            className="rounded-xl px-4 py-1"
          >
            {settings.enabled ? "نشط" : "معطل"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Rules Card */}
        <Card className="rounded-[2.5rem] border-border/60 shadow-soft overflow-hidden xl:col-span-2">
          <CardContent className="p-8 space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Target size={20} />
              </div>
              <h3 className="text-lg font-black text-main">
                مستويات العضوية (Tiers)
              </h3>
            </div>

            <div className="space-y-4">
              {settings.tiers.map((tier, idx) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={idx}
                  className="flex flex-col md:flex-row items-center gap-4 p-5 rounded-3xl bg-soft/50 border border-border/40 hover:border-accent/30 transition-all group"
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg",
                      tier.color || "bg-accent",
                    )}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground mr-1">
                        اسم المستوى
                      </label>
                      <Input
                        value={tier.name}
                        onChange={(e) =>
                          updateTier(idx, "name", e.target.value)
                        }
                        className="h-10 rounded-xl font-bold bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground mr-1">
                        الزيارات المطلوبة
                      </label>
                      <Input
                        type="number"
                        value={tier.min_visits}
                        onChange={(e) =>
                          updateTier(idx, "min_visits", Number(e.target.value))
                        }
                        className="h-10 rounded-xl font-bold bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground mr-1">
                        نسبة الخصم (%)
                      </label>
                      <div className="relative">
                        <Percent
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          size={14}
                        />
                        <Input
                          type="number"
                          value={tier.discount_percent}
                          onChange={(e) =>
                            updateTier(
                              idx,
                              "discount_percent",
                              Number(e.target.value),
                            )
                          }
                          className="h-10 rounded-xl font-bold bg-white pl-9"
                        />
                      </div>
                    </div>
                  </div>
                  {idx > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-danger hover:bg-danger/10 h-10 w-10 rounded-xl"
                      onClick={() => removeTier(idx)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  )}
                </motion.div>
              ))}

              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl border-dashed border-border/80 hover:border-accent hover:bg-accent/5 text-muted hover:text-accent font-black transition-all"
                onClick={addTier}
              >
                <Plus size={18} className="ml-2" /> إضافة مستوى جديد
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Points Config */}
        <div className="space-y-8">
          <Card className="rounded-[2.5rem] border-border/60 shadow-soft overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <Star size={20} />
                </div>
                <h3 className="text-lg font-black text-main">اكتساب النقاط</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    معدل الاكتساب (نقطة لكل 1 جنيه)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.points_per_egp}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        points_per_egp: Number(e.target.value),
                      })
                    }
                    className="h-14 rounded-2xl bg-soft border-border font-black text-xl px-6 focus:bg-white transition-all"
                  />
                  <p className="text-[10px] font-medium text-muted-foreground italic">
                    مثال: 0.1 تعني أن العميل يحصل على نقطة واحدة لكل 10 جنيهات.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    قيمة الاستبدال (جنيه لكل 1 نقطة)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.redemption_rate}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        redemption_rate: Number(e.target.value),
                      })
                    }
                    className="h-14 rounded-2xl bg-soft border-border font-black text-xl px-6 focus:bg-white transition-all"
                  />
                  <p className="text-[10px] font-medium text-muted-foreground italic">
                    مثال: 0.5 تعني أن كل 100 نقطة تساوي 50 جنيهاً رصيد.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] bg-indigo-900 text-white shadow-xl shadow-indigo-500/20 p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 transition-transform group-hover:scale-150" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3 text-[10px] font-black text-indigo-200 uppercase tracking-widest">
                <Zap size={16} strokeWidth={3} /> استراتيجية ذكية
              </div>
              <p className="text-sm font-bold leading-relaxed">
                تفعيل نظام الولاء يشجع العملاء على العودة بنسبة تصل إلى 40%
                أكثر، مما يرفع من متوسط القيمة الشرائية (LTV).
              </p>
              <div className="pt-2">
                <Button
                  className="w-full h-12 bg-white text-indigo-900 hover:bg-indigo-50 rounded-xl font-black transition-all"
                  loading={saving}
                  onClick={handleSave}
                >
                  <Save size={18} className="ml-2" /> اعتماد وخدمة العملاء
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="p-8 bg-soft/50 rounded-[2.5rem] border border-dashed border-border/60">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-main shadow-sm shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-main">حساب آلي</h4>
              <p className="text-[10px] font-medium text-muted-foreground mt-1">
                يتم احتساب النقاط وتحديث المستوى تلقائياً عند تأكيد الدفع.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-main shadow-sm shrink-0">
              <Gift size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-main">تنبيهات فورية</h4>
              <p className="text-[10px] font-medium text-muted-foreground mt-1">
                يظهر مستوى العميل ونقاطه لموظف الاستقبال لتقديم ترحيب VIP.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-main shadow-sm shrink-0">
              <Activity size={20} />
            </div>
            <div>
              <h4 className="text-xs font-black text-main">تحليلات دقيقة</h4>
              <p className="text-[10px] font-medium text-muted-foreground mt-1">
                تقارير خاصة بمدى تأثير الخصومات على زيادة المبيعات الشهرية.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
