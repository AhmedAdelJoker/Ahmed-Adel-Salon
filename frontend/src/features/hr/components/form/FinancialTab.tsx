/** HR FinancialTab (moved from HRManagement page, no logic changes). */
import type { Dispatch, SetStateAction } from "react";
import type { EmployeeRecord } from "@/types/employee";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, TrendingUp, Plus, Trash2, Wallet } from "lucide-react";
import {
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_SELECT_CLASS,
} from "@/features/hr";

export default function FinancialTab({
  formData,
  setFormData,
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
}) {
  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <DollarSign size={14} /> الراتب الأساسي
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={formData.baseSalary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        baseSalary: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={`${FIELD_INPUT_CLASS} pr-12`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">
                    ج.م
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <TrendingUp size={14} /> نسبة العمولة
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    value={formData.commissionRate}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        commissionRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={`${FIELD_INPUT_CLASS} pr-12`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Plus size={14} /> حوافز ثابتة
                </label>
                <Input
                  type="number"
                  value={formData.fixedBonus}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fixedBonus: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Trash2 size={14} /> خصومات دورية
                </label>
                <Input
                  type="number"
                  value={formData.defaultDeductions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      defaultDeductions: parseFloat(e.target.value) || 0,
                    })
                  }
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Wallet size={14} /> قناة صرف المستحقات
                </label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(v) =>
                    setFormData({ ...formData, paymentMethod: v })
                  }
                >
                  <SelectTrigger className={FIELD_SELECT_CLASS}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="cash">نقدي (Cash)</SelectItem>
                    <SelectItem value="wallet">
                      محفظة إلكترونية (Wallet)
                    </SelectItem>
                    <SelectItem value="bank">تحويل بنكي (Bank)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
  );
}
