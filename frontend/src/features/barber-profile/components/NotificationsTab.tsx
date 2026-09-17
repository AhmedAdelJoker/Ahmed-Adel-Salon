import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Calendar, Clock, XCircle, Sun, DollarSign, Zap, type LucideProps } from "lucide-react";
import type { NotificationsState, NotificationKey } from "@/features/barber-profile/types";

interface NotificationsTabProps {
  notifications: NotificationsState;
  setNotifications: React.Dispatch<React.SetStateAction<NotificationsState>>;
  onSaveNotifications: () => void | Promise<void>;
}

type NotificationItem = {
  key: NotificationKey;
  label: string;
  desc: string;
  icon: React.ComponentType<LucideProps>;
};

const notificationItems: NotificationItem[] = [
  {
    key: "new_appointment",
    label: "حجز جديد",
    desc: "عندما يتم إسناد حجز جديد لك",
    icon: Calendar,
  },
  {
    key: "appointment_reminder",
    label: "تذكير بالمواعيد",
    desc: "قبل 30 دقيقة من الموعد",
    icon: Clock,
  },
  {
    key: "appointment_cancelled",
    label: "إلغاء المواعيد",
    desc: "عندما يلغي العميل حجزه",
    icon: XCircle,
  },
  {
    key: "shift_reminder",
    label: "تذكير الوردية",
    desc: "قبل بداية ورديتك",
    icon: Sun,
  },
  {
    key: "tips",
    label: "البشكيرش",
    desc: "عند استلام بشكيرش",
    icon: DollarSign,
  },
  {
    key: "marketing",
    label: "العروض والتسويق",
    desc: "عروض خاصة وأخبار",
    icon: Zap,
  },
];

export const NotificationsTab = ({
  notifications,
  setNotifications,
  onSaveNotifications,
}: NotificationsTabProps) => {
  return (
    <TabsContent value="notifications" className="space-y-4">
      <div className="rounded-2xl border border-border bg-white p-5 shadow-soft">
        <h3 className="text-sm font-black text-main mb-4 flex items-center gap-2">
          <Bell size={16} className="text-primary" /> تفضيلات الإشعارات
        </h3>
        <div className="space-y-3">
          {notificationItems.map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-3 rounded-xl border border-border bg-soft/50 hover:bg-soft transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <item.icon size={16} className="text-primary" />
                </div>
                <div>
                  <p className="font-black text-main">{item.label}</p>
                  <p className="text-xs text-muted">{item.desc}</p>
                </div>
              </div>
              <Switch
                checked={notifications[item.key]}
                onCheckedChange={(checked) =>
                  setNotifications({
                    ...notifications,
                    [item.key]: checked,
                  })
                }
              />
            </label>
          ))}
        </div>
        <Button className="w-full mt-4" onClick={onSaveNotifications}>
          حفظ الإشعارات
        </Button>
      </div>
    </TabsContent>
  );
};
