import { Link } from "react-router-dom";
import { Layers3, Settings2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

const GROUPS = [
  {
    title: "اختصارات الإدارة",
    description:
      "روابط مباشرة للواجهات التنفيذية التي تستخدم كثيراً داخل المنظومة.",
    items: [
      {
        title: "إعدادات النشاط",
        to: "/owner/business-settings",
        note: "بيانات الصالون والفاتورة ووسائل التواصل.",
      },
      {
        title: "الخزنة",
        to: "/owner/cashbox",
        note: "ملخص الحركة النقدية وسجل المعاملات.",
      },
      {
        title: "التفضيلات",
        to: "/owner/preferences",
        note: "اللغة والثيم والإشعارات.",
      },
      {
        title: "المستخدمون",
        to: "/owner/users",
        note: "إدارة المستخدمين والأدوار الأساسية.",
      },
    ],
  },
  {
    title: "تقارير وتشغيل",
    description:
      "مداخل سريعة للمتابعة التشغيلية بدلاً من المسارات غير المرتبطة سابقاً.",
    items: [
      {
        title: "التقارير التشغيلية",
        to: "/owner/reports",
        note: "تحليل الأداء والتقارير المتقدمة.",
      },
      {
        title: "الجدول",
        to: "/schedule",
        note: "عرض الجدولة والمهام اليومية.",
      },
    ],
  },
];

export default function ConnectedPages() {
  return (
    <div className="space-y-8" dir="rtl">
      <Card className="border-black/10 bg-white/90 dark:border-white/10 dark:bg-[#171717]/90">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-[#6D28D9] dark:bg-cyan-400/10 dark:text-[#22D3EE]">
              <Layers3 size={22} />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-gray-950 dark:text-gray-50">
                الصفحات الموصولة حديثاً
              </CardTitle>
              <p className="mt-1 text-sm font-bold text-gray-500 dark:text-gray-400">
                نقطة دخول سريعة لمراجعة الصفحات التي كانت موجودة في المشروع وغير
                مرتبطة بالتنقل.
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {GROUPS.map((group) => (
        <Card
          key={group.title}
          className="border-black/10 bg-white/90 dark:border-white/10 dark:bg-[#171717]/90"
        >
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200">
                <Settings2 size={18} />
              </div>
              <div>
                <CardTitle className="text-xl font-black text-gray-950 dark:text-gray-50">
                  {group.title}
                </CardTitle>
                <p className="mt-1 text-sm font-bold text-gray-500 dark:text-gray-400">
                  {group.description}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {group.items.map((item) => (
              <div
                key={item.to}
                className="rounded-3xl border border-border bg-gray-50/70 p-5 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-black text-gray-950 dark:text-gray-50">
                      {item.title}
                    </div>
                    <div className="mt-2 text-sm font-bold text-gray-500 dark:text-gray-400">
                      {item.note}
                    </div>
                    <div className="mt-3 text-xs font-bold text-[#6D28D9] dark:text-[#22D3EE]">
                      {item.to}
                    </div>
                  </div>
                  <Button asChild variant="outline" className="shrink-0">
                    <Link to={item.to}>
                      <ExternalLink size={16} />
                      فتح
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
