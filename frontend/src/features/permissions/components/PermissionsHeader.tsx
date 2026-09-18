import { ShieldCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate: () => void;
};

export default function PermissionsHeader({ onCreate }: Props) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
          <ShieldCheck className="text-white w-8 h-8" strokeWidth={2} />
        </div>
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-main uppercase tracking-tight leading-none">
            الأمان والصلاحيات
          </h1>
          <p className="text-base font-medium text-muted">
            إدارة مصفوفة الوصول، الهويات الرقمية، والرقابة الأمنية للمنظومة
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="primary"
        title="إصدار هوية أمنية جديدة لموظف معتمد"
        onClick={onCreate}
        className="rounded-xl font-black px-10 h-14 shadow-lg shadow-accent/20 text-lg"
      >
        <Plus className="ml-2" size={20} strokeWidth={2.5} /> إضافة مستخدم
      </Button>
    </div>
  );
}
