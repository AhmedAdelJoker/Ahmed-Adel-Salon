import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { businessSettingsService } from "@/services/businessSettingsService";
import { getApiErrorMessage } from "@/lib/core/utils";
import type { LoyaltySettings } from "@/types/loyalty";
import {
  DEFAULT_LOYALTY_SETTINGS,
  normalizeLoyaltySettings,
  toLoyaltyPayload,
  validateLoyaltySettings,
} from "@/features/loyalty/utils/loyaltyHelpers";

export type LoyaltyTierField = "name" | "min_visits" | "discount_percent";
export type LoyaltyRuleField = "points_per_egp" | "redemption_rate" | "points_expiry_months";

export function useLoyaltySettings() {
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = (await businessSettingsService.get()) as Record<string, unknown> | null;
      const raw = data?.loyalty_settings ?? data?.loyaltySettings;
      if (raw) setSettings(normalizeLoyaltySettings(raw));
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل تحميل إعدادات الولاء"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /** يتحقق أولاً؛ أي إعداد غير منطقي يمنع الحفظ برسالة عربية واضحة */
  const save = useCallback(async () => {
    const error = validateLoyaltySettings(settings);
    if (error) {
      toast.error(error);
      return false;
    }
    try {
      setSaving(true);
      await businessSettingsService.update(toLoyaltyPayload(settings));
      toast.success("تم حفظ إعدادات نظام الولاء");
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "فشل حفظ الإعدادات"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings((s) => ({ ...s, enabled }));
  }, []);

  const setRule = useCallback((field: LoyaltyRuleField, value: number) => {
    setSettings((s) => ({ ...s, [field]: value }));
  }, []);

  const updateTier = useCallback((index: number, field: LoyaltyTierField, value: string | number) => {
    setSettings((s) => ({
      ...s,
      tiers: s.tiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    }));
  }, []);

  const addTier = useCallback(() => {
    setSettings((s) => {
      const lastVisits = s.tiers.length ? Number(s.tiers[s.tiers.length - 1].min_visits) || 0 : 0;
      return {
        ...s,
        tiers: [
          ...s.tiers,
          { name: "مستوى جديد", min_visits: lastVisits + 10, discount_percent: 15, color: "bg-blue-500" },
        ],
      };
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setSettings((s) => ({ ...s, tiers: s.tiers.filter((_, i) => i !== index) }));
  }, []);

  return {
    settings,
    loading,
    saving,
    setEnabled,
    setRule,
    updateTier,
    addTier,
    removeTier,
    save,
    reload: fetchSettings,
  };
}
