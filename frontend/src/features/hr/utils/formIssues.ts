/**
 * The wizard's single source of truth for "what is wrong on this step".
 *
 * One pure function reads the whole form and answers per step, so the three
 * places that need the answer cannot drift apart: the red dot on the stepper,
 * the "next" gate, and a final re-check at submit. It reports only what is
 * *wrong* (typed but invalid, or two fields that contradict each other) —
 * empty required fields stay the submit's business, because flagging them the
 * moment the dialog opens would paint the stepper red before anyone touched it.
 */
import type { EmployeeRecord } from "@/types/employee";
import { FormStepId } from "./constants";
import { validatePhone, validateEmployeeEmail } from "./phone";
import { analyzeNationalId } from "./nationalId";
import {
  validatePersonName,
  validateUsername,
  validateMoney,
  validateCommission,
  validateBankAccount,
  passwordRequirements,
} from "./validators";

export type EmployeeFormIssues = Record<FormStepId, string[]>;

export function collectEmployeeFormIssues(formData: EmployeeRecord): EmployeeFormIssues {
  const issues: EmployeeFormIssues = {
    personal: [],
    work: [],
    system: [],
    skills: [],
    financial: [],
    assistant: [],
    documents: [],
  };

  const typedName = String(formData.fullName ?? "").trim();
  if (typedName) {
    const nameError = validatePersonName(typedName);
    if (nameError) issues.personal.push(nameError);
  }

  const typedPhone = String(formData.phonePrimary ?? "").trim();
  if (typedPhone) {
    const phoneError = validatePhone(typedPhone);
    if (phoneError) issues.personal.push(phoneError);
  }

  const typedEmail = String(formData.email ?? "").trim();
  if (typedEmail) {
    const emailError = validateEmployeeEmail(typedEmail);
    if (emailError) issues.personal.push(emailError);
  }

  const idAnalysis = analyzeNationalId(formData.nationalId);
  if (idAnalysis.error) issues.personal.push(idAnalysis.error);
  // The id encodes the birth date; a birth date that disagrees with it means
  // one of the two was mistyped and the payroll file would carry the wrong one.
  if (
    idAnalysis.info &&
    formData.birthDate &&
    formData.birthDate !== idAnalysis.info.birthDate
  ) {
    issues.personal.push(
      `تاريخ الميلاد لا يطابق المسجل في الرقم القومي (${idAnalysis.info.birthDate})`,
    );
  }

  // A contract that ends before it starts excludes someone from renewal
  // reminders forever, silently.
  const contractEnd = String(formData.contractEndDate ?? "").trim();
  const hiredOn = String(formData.hireDate ?? "").trim();
  if (contractEnd && hiredOn && contractEnd < hiredOn) {
    issues.work.push("تاريخ انتهاء العقد لا يمكن أن يسبق تاريخ التعيين");
  }

  if (formData.hasLoginAccount) {
    const typedUsername = String(formData.username ?? "").trim();
    if (typedUsername) {
      const usernameError = validateUsername(typedUsername);
      if (usernameError) issues.system.push(usernameError);
    }
    const typedPassword = String(formData.password ?? "");
    if (typedPassword) {
      const unmet = passwordRequirements(typedPassword).filter((r) => !r.met);
      if (unmet.length > 0) {
        issues.system.push(`كلمة المرور: ${unmet[0].label}`);
      }
    }
  }

  const moneyFields: Array<[string, unknown]> = [
    ["الراتب الأساسي", formData.baseSalary],
    ["الحافز الثابت", formData.fixedBonus],
    ["الخصومات الثابتة", formData.defaultDeductions],
  ];
  for (const [label, value] of moneyFields) {
    const moneyError = validateMoney(value, label);
    if (moneyError) issues.financial.push(moneyError);
  }
  const commissionError = validateCommission(formData.commissionRate);
  if (commissionError) issues.financial.push(commissionError);

  const paymentMethod = String(formData.paymentMethod ?? "cash");
  const typedWallet = String(formData.walletNumber ?? "").trim();
  if (typedWallet) {
    // A wallet number is a mobile number, so it answers to the phone rules.
    const walletError = validatePhone(typedWallet);
    if (walletError) issues.financial.push(`رقم المحفظة: ${walletError}`);
  } else if (paymentMethod === "wallet") {
    issues.financial.push("رقم المحفظة مطلوب عند اختيار التحويل للمحفظة");
  }

  const typedBank = String(formData.bankAccount ?? "").trim();
  if (typedBank) {
    const bankError = validateBankAccount(typedBank);
    if (bankError) issues.financial.push(bankError);
  } else if (paymentMethod === "bank") {
    issues.financial.push("رقم الحساب البنكي مطلوب عند اختيار التحويل البنكي");
  }

  return issues;
}

/** Safe lookup for callers holding a tab id that may be "review" (never a FormStepId). */
export function issuesForStep(issues: EmployeeFormIssues, stepId: string): string[] {
  return (issues as Record<string, string[]>)[stepId] ?? [];
}
