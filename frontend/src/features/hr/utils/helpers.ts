import { JOB_TITLES } from "@/features/hr/utils/constants";

export const getJobTitleLabel = (value: any) =>
  JOB_TITLES.find((item) => item.value === value)?.label || value || "غير محدد";

export const isCustomJobTitleValue = (value: any) =>
  !JOB_TITLES.some((item) => item.value === value);

export const deriveDateOnly = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") {
    if (value.includes("T")) return value.split("T")[0];
    if (value.includes(" ")) return value.split(" ")[0];
  }
  return value;
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
