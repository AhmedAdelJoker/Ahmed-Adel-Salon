import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Settings, Palette, Moon, Sun, Wifi, type LucideProps } from "lucide-react";
import { cn } from "@/lib/core/utils";
import type { AppearanceState } from "@/features/barber-profile/types";

interface AppearanceTabProps {
  appearance: AppearanceState;
  setAppearance: React.Dispatch<React.SetStateAction<AppearanceState>>;
}

type ThemeOption = {
  value: string;
  label: string;
  icon: React.ComponentType<LucideProps>;
};

const themeOptions: ThemeOption[] = [
  { value: "light", label: "فاتح", icon: Sun },
  { value: "dark", label: "داكن", icon: Moon },
  { value: "system", label: "النظام", icon: Wifi },
];

export const AppearanceTab = ({ appearance, setAppearance }: AppearanceTabProps) => {
  return (
    <TabsContent value="appearance" className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <Palette size={16} className="text-primary" /> السمة
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((theme) => (
            <button
              key={theme.value}
              onClick={() => setAppearance({ ...appearance, theme: theme.value })}
              className={cn(
                "p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all",
                appearance.theme === theme.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
              )}
            >
              <theme.icon
                size={24}
                className={cn(
                  appearance.theme === theme.value ? "text-primary" : "text-muted",
                )}
              />
              <span className="font-black text-sm">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <Settings size={16} className="text-primary" /> تفضيلات الواجهة
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-border hover:bg-soft transition-colors">
            <div>
              <p className="font-black text-main">الوضع المدمج</p>
              <p className="text-xs text-muted">تقليل المسافات لعرض محتوى أكثر</p>
            </div>
            <Switch
              checked={appearance.compact_mode}
              onCheckedChange={(checked) =>
                setAppearance({ ...appearance, compact_mode: checked })
              }
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-border hover:bg-soft transition-colors">
            <div>
              <p className="font-black text-main">الرسوم المتحركة</p>
              <p className="text-xs text-muted">تفعيل انتقالات وتأثيرات الحركة</p>
            </div>
            <Switch
              checked={appearance.animations}
              onCheckedChange={(checked) =>
                setAppearance({ ...appearance, animations: checked })
              }
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-border hover:bg-soft transition-colors">
            <div>
              <p className="font-black text-main">الأصوات</p>
              <p className="text-xs text-muted">أصوات التنبيهات والتفاعلات</p>
            </div>
            <Switch
              checked={appearance.sound}
              onCheckedChange={(checked) => setAppearance({ ...appearance, sound: checked })}
            />
          </label>
        </div>
      </div>
    </TabsContent>
  );
};
