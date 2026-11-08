import {
  ARCHIVE_REASON_LABEL_KEY,
  JOB_TITLES,
} from "@/features/hr/utils/constants";
import { currencyLabel, getCurrency } from "@/lib/core/currency";

/**
 * Who serves customers directly — the twin of `SERVICE_PROVIDER_JOB_TITLES` in
 * `backend/app/core/employee_rules.py`. Only these titles can appear on the
 * public online-booking site (with the owner's switch on); the server enforces
 * it too, so this copy decides what the UI *offers*, not what is allowed.
 */
export const SERVICE_PROVIDER_JOB_TITLES = [
  "barber",
  "hairstylist",
  "colorist",
  "esthetician",
  "nail_technician",
];

export const isServiceProviderJobTitle = (value: any) =>
  SERVICE_PROVIDER_JOB_TITLES.includes(String(value ?? "").trim().toLowerCase());

export const getJobTitleLabel = (value: any) =>
  JOB_TITLES.find((item) => item.value === value)?.label || value || "غير محدد";

export const isCustomJobTitleValue = (value: any) =>
  !JOB_TITLES.some((item) => item.value === value);

/**
 * The stored job-title code, rendered in the reader's language.
 *
 * The labels in `constants.ts` are Arabic because they are also the labels
 * written into the database/seed path. Rendering them directly was why an
 * English interface still said "حلاق" under every name. This maps the known
 * codes to translation keys and leaves a genuinely custom title (typed by the
 * owner) exactly as written.
 */
const JOB_TITLE_LABEL_KEY: Record<string, string> = {
  owner: "hr.jobTitleOwner",
  manager: "hr.jobTitleManager",
  accountant: "hr.jobTitleAccountant",
  barber: "hr.jobTitleBarber",
  hairstylist: "hr.jobTitleHairstylist",
  colorist: "hr.jobTitleColorist",
  esthetician: "hr.jobTitleEsthetician",
  nail_technician: "hr.jobTitleNailTechnician",
  barber_assistant: "hr.jobTitleBarberAssistant",
  cashier: "hr.jobTitleCashier",
  receptionist: "hr.jobTitleReceptionist",
  cleaner: "hr.jobTitleCleaner",
  other: "hr.jobTitleOther",
};

export const jobTitleLabel = (
  value: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const raw = String(value ?? "").trim();
  const key = JOB_TITLE_LABEL_KEY[raw.toLowerCase()];
  if (key) return t(key);
  return raw || t("hr.notSpecified");
};

const EMPLOYMENT_TYPE_LABEL_KEY: Record<string, string> = {
  full_time: "hr.employmentFullTime",
  part_time: "hr.employmentPartTime",
  temporary: "hr.employmentTemporary",
};

export const employmentTypeLabel = (
  value: unknown,
  t: (key: string, options?: Record<string, unknown>) => string,
): string => {
  const raw = String(value ?? "").trim();
  const key = EMPLOYMENT_TYPE_LABEL_KEY[raw.toLowerCase()];
  if (key) return t(key);
  return raw || "—";
};

/**
 * A date-only value rendered in the reader's locale.
 *
 * `new Date("2026-10-15")` parses as UTC midnight, so a browser west of UTC
 * renders the previous day. Employee dates are calendar days, not instants;
 * pinning the parse to local midnight keeps the day the server sent.
 */
export const formatEmployeeDate = (
  value: unknown,
  locale: string,
): string | null => {
  const dateOnly = deriveDateOnly(value);
  if (!dateOnly) return null;
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(locale);
};

/** The salon's currency, written the way the current UI language writes it. */
export const currencyLabelForLanguage = (language?: string): string =>
  String(language ?? "ar").toLowerCase().startsWith("ar")
    ? currencyLabel()
    : getCurrency();

/**
 * Salary/commission in the active language.
 *
 * `formatCurrency` always prints the Arabic currency label and two decimals;
 * that is correct for receipts, but in the English roster it produced
 * "7,000.00 ج.م". This keeps the amount and the label on the same language.
 */
export const formatEmployeeMoney = (
  value: unknown,
  locale: string,
  language?: string,
): string => {
  const num = Number(value ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe);
  return `${formatted} ${currencyLabelForLanguage(language)}`;
};

/**
 * The label for a stored archive reason.
 *
 * Known codes render in the reader's language. Anything else is shown exactly
 * as it was written: a reason typed by hand into the column is still the note
 * the owner left, and translating it into "أخرى" would throw the detail away.
 */
export const archiveReasonLabel = (
  value: string | null | undefined,
  t: (key: string) => string,
): string => {
  if (!value) return "";
  const key = ARCHIVE_REASON_LABEL_KEY[value];
  return key ? t(key) : value;
};

/**
 * How long someone worked here, in whole years and months.
 *
 * Both dates are `YYYY-MM-DD` strings; `to` defaults to nothing, and a missing
 * either side returns null rather than a number. A tenure the page invented
 * from "unknown" would be read as fact by whoever is arguing about end of
 * service.
 */
export const tenureBetween = (
  from?: string | null,
  to?: string | null,
): { years: number; months: number } | null => {
  if (!from || !to) return null;
  const start = new Date(`${String(from).slice(0, 10)}T00:00:00`);
  const end = new Date(`${String(to).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) return null;

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months };
};

export const deriveDateOnly = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") {
    if (value.includes("T")) return value.split("T")[0];
    if (value.includes(" ")) return value.split(" ")[0];
  }
  return value;
};

/** "2 years and 3 months" for a hire date, or null when either end is unknown. */
export const tenureLabel = (
  from?: string | null,
  to?: string | null,
  t?: (key: string, options?: Record<string, unknown>) => string,
): string | null => {
  const tenure = tenureBetween(from, to);
  if (!tenure || !t) return null;
  return tenure.years > 0
    ? t("hr.tenureYears", { years: tenure.years, months: tenure.months })
    : t("hr.tenureMonths", { months: tenure.months });
};

export const normalizeEmployeeRecord = (employee: any = {}): any => {
  const fullName =
    employee.fullName ||
    employee.full_name ||
    employee.displayName ||
    employee.display_name ||
    "موظف";
  const displayName =
    employee.displayName || employee.display_name || fullName || "";
  const status =
    employee.status ||
    (employee.isActive === false || employee.is_active === false
      ? "suspended"
      : "active");
  const jobTitle =
    employee.jobTitle || employee.job_title || employee.role || "barber";

  return {
    ...employee,
    id: employee.id ?? employee.employee_id ?? employee.employeeId,
    fullName,
    displayName,
    phonePrimary: employee.phonePrimary || employee.phone_primary || "",
    phoneSecondary: employee.phoneSecondary || employee.phone_secondary || "",
    profileImageUrl:
      employee.profileImageUrl || employee.profile_image_url || "",
    bioAr: employee.bioAr || employee.bio_ar || "",
    bioEn: employee.bioEn || employee.bio_en || "",
    nationalId: employee.nationalId || employee.national_id || "",
    birthDate: deriveDateOnly(employee.birthDate || employee.birth_date),
    governorate: employee.governorate || "",
    city: employee.city || "",
    detailedAddress:
      employee.detailedAddress || employee.detailed_address || "",
    personalNotes: employee.personalNotes || employee.personal_notes || "",
    jobTitle,
    department: employee.department || "",
    employmentType:
      employee.employmentType || employee.employment_type || "full_time",
    hireDate: deriveDateOnly(
      employee.hireDate || employee.hire_date || employee.created_at,
    ),
    // The archive's own two facts. `archivedOn` is a date the server derived
    // from the shop's calendar, not an instant: an ISO timestamp printed by a
    // browser in another timezone lands a day early, and the archive page is
    // read in payroll disputes where the day is the whole argument.
    archivedOn: deriveDateOnly(employee.archivedOn || employee.archived_on),
    archiveReason: employee.archiveReason || employee.archive_reason || "",
    status,
    showInPos: employee.showInPos ?? employee.show_in_pos ?? true,
    showInBooking: employee.showInBooking ?? employee.show_in_booking ?? true,
    displayOrder: Number(employee.displayOrder ?? employee.display_order ?? 0),
    baseSalary: Number(employee.baseSalary ?? employee.base_salary ?? 0),
    commissionRate: Number(
      employee.commissionRate ?? employee.commission_rate ?? 0,
    ),
    fixedBonus: Number(employee.fixedBonus ?? employee.fixed_bonus ?? 0),
    defaultDeductions: Number(
      employee.defaultDeductions ?? employee.default_ded_uctions ?? 0,
    ),
    paymentMethod: employee.paymentMethod || employee.payment_method || "cash",
    walletNumber: employee.walletNumber || employee.wallet_number || "",
    bankAccount: employee.bankAccount || employee.bank_account || "",
    assistantOfBarberId: String(
      employee.assistantOfBarberId ?? employee.assistant_of_barber_id ?? "",
    ),
    assistantTasksJson: Array.isArray(
      employee.assistantTasksJson ?? employee.assistant_tasks_json,
    )
      ? (employee.assistantTasksJson ?? employee.assistant_tasks_json)
      : [],
    receivesCommission:
      employee.receivesCommission ?? employee.receives_commission ?? false,
    assistantCommissionRate: Number(
      employee.assistantCommissionRate ??
        employee.assistant_commission_rate ??
        0,
    ),
    hasLoginAccount: Boolean(
      employee.hasLoginAccount ??
      employee.has_login_account ??
      employee.username ??
      employee.user_id,
    ),
    username: employee.username || "",
    password: employee.password || "",
    role: employee.role || "barber",
    serviceIds: Array.isArray(employee.services)
      ? employee.services.map((s) => s.id)
      : employee.serviceIds || [],
  };
};
