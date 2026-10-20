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
import { DollarSign, TrendingUp, Plus, Trash2, Wallet, Landmark } from "lucide-react";
import { currencyLabel } from "@/lib/core/currency";
import {
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_SELECT_CLASS,
} from "@/features/hr";
import {
  validateMoney,
  validateCommission,
  validateBankAccount,
} from "@/features/hr/utils/validators";
import {
  validatePhone,
  normalizePhoneTyping,
  MAX_PHONE_DIGITS,
} from "@/features/hr/utils/phone";
import FieldError from "./FieldError";
import MoneyInput from "./MoneyInput";

export default function FinancialTab({
  formData,
  setFormData,
}: {
  formData: EmployeeRecord;
  setFormData: Dispatch<SetStateAction<EmployeeRecord>>;
}) {
  const salaryError = validateMoney(formData.baseSalary, "الراتب الأساسي");
  const commissionError = validateCommission(formData.commissionRate);
  const bonusError = validateMoney(formData.fixedBonus, "الحافز الثابت");
  const deductionsError = validateMoney(
    formData.defaultDeductions,
    "الخصومات الثابتة",
  );

  const paymentMethod = String(formData.paymentMethod ?? "cash");
  const typedWallet = String(formData.walletNumber ?? "").trim();
  const walletError = typedWallet
    ? validatePhone(typedWallet)
    : paymentMethod === "wallet"
      ? "رقم المحفظة مطلوب عند اختيار التحويل للمحفظة"
      : null;
  const typedBank = String(formData.bankAccount ?? "").trim();
  const bankError = typedBank
    ? validateBankAccount(typedBank)
    : paymentMethod === "bank"
      ? "رقم الحساب البنكي مطلوب عند اختيار التحويل البنكي"
      : null;

  return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <DollarSign size={14} /> الراتب الأساسي
                </label>
                <MoneyInput
                  value={formData.baseSalary}
                  onChange={(v) => setFormData({ ...formData, baseSalary: v })}
                  suffix={currencyLabel()}
                  invalid={Boolean(salaryError)}
                  describedBy={salaryError ? "base-salary-error" : undefined}
                />
                {salaryError && (
                  <FieldError id="base-salary-error">{salaryError}</FieldError>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <TrendingUp size={14} /> نسبة العمولة
                </label>
                <MoneyInput
                  value={formData.commissionRate}
                  onChange={(v) =>
                    setFormData({ ...formData, commissionRate: v })
                  }
                  suffix="%"
                  invalid={Boolean(commissionError)}
                  describedBy={commissionError ? "commission-error" : undefined}
                />
                {commissionError && (
                  <FieldError id="commission-error">{commissionError}</FieldError>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Plus size={14} /> حوافز ثابتة
                </label>
                <MoneyInput
                  value={formData.fixedBonus}
                  onChange={(v) => setFormData({ ...formData, fixedBonus: v })}
                  invalid={Boolean(bonusError)}
                  describedBy={bonusError ? "fixed-bonus-error" : undefined}
                />
                {bonusError && (
                  <FieldError id="fixed-bonus-error">{bonusError}</FieldError>
                )}
              </div>
              <div className="space-y-2">
                <label className={FIELD_LABEL_CLASS}>
                  <Trash2 size={14} /> خصومات دورية
                </label>
                <MoneyInput
                  value={formData.defaultDeductions}
                  onChange={(v) =>
                    setFormData({ ...formData, defaultDeductions: v })
                  }
                  invalid={Boolean(deductionsError)}
                  describedBy={
                    deductionsError ? "deductions-error" : undefined
                  }
                />
                {deductionsError && (
                  <FieldError id="deductions-error">{deductionsError}</FieldError>
                )}
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
              {/*
                The wallet and bank account have been part of the record and the
                API since the beginning — but the form had no field for either,
                so the only way to set them was outside the app. Shown only when
                the chosen channel needs them, so cash payrolls never see fields
                they do not use.
              */}
              {paymentMethod === "wallet" && (
                <div className="md:col-span-2 space-y-2">
                  <label className={FIELD_LABEL_CLASS}>
                    <Wallet size={14} /> رقم المحفظة الإلكترونية
                  </label>
                  <Input
                    value={String(formData.walletNumber ?? "")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        walletNumber: normalizePhoneTyping(e.target.value),
                      })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={MAX_PHONE_DIGITS}
                    autoComplete="off"
                    placeholder="01xxxxxxxxx"
                    aria-invalid={Boolean(walletError)}
                    aria-describedby={walletError ? "wallet-number-error" : undefined}
                  />
                  {walletError && (
                    <FieldError id="wallet-number-error">
                      رقم المحفظة: {walletError}
                    </FieldError>
                  )}
                </div>
              )}
              {paymentMethod === "bank" && (
                <div className="md:col-span-2 space-y-2">
                  <label className={FIELD_LABEL_CLASS}>
                    <Landmark size={14} /> رقم الحساب البنكي
                  </label>
                  <Input
                    value={String(formData.bankAccount ?? "")}
                    onChange={(e) =>
                      setFormData({ ...formData, bankAccount: e.target.value })
                    }
                    className={FIELD_INPUT_CLASS}
                    dir="ltr"
                    maxLength={34}
                    autoComplete="off"
                    placeholder="EG… أو رقم الحساب المحلي"
                    aria-invalid={Boolean(bankError)}
                    aria-describedby={bankError ? "bank-account-error" : undefined}
                  />
                  {bankError && (
                    <FieldError id="bank-account-error">{bankError}</FieldError>
                  )}
                </div>
              )}
            </div>
          </div>
  );
}
