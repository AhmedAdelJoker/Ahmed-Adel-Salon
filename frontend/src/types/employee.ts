/**
 * Canonical employee record — merged from HR, Payroll & Attendance pages.
 * All fields optional: the backend returns mixed snake_case / camelCase shapes.
 */
export interface EmployeeRecord {
  id?: number | string;
  employee_id?: number | string;
  employeeId?: number | string;
  fullName?: string;
  full_name?: string;
  displayName?: string;
  display_name?: string;
  name?: string;
  status?: string;
  isActive?: boolean;
  is_active?: boolean;
  jobTitle?: string;
  job_title?: string;
  role?: string;
  phonePrimary?: string;
  phone_primary?: string;
  phoneSecondary?: string;
  phone_secondary?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
  bioAr?: string;
  bio_ar?: string;
  bioEn?: string;
  bio_en?: string;
  nationalId?: string;
  national_id?: string;
  birthDate?: string;
  birth_date?: string;
  governorate?: string;
  city?: string;
  detailedAddress?: string;
  detailed_address?: string;
  personalNotes?: string;
  personal_notes?: string;
  department?: string;
  employmentType?: string;
  employment_type?: string;
  hireDate?: string;
  hire_date?: string;
  created_at?: string;
  showInPos?: boolean;
  show_in_pos?: boolean;
  showInBooking?: boolean;
  show_in_booking?: boolean;
  displayOrder?: number | string;
  display_order?: number | string;
  baseSalary?: number | string;
  base_salary?: number | string;
  commissionRate?: number | string;
  commission_rate?: number | string;
  fixedBonus?: number | string;
  fixed_bonus?: number | string;
  defaultDeductions?: number | string;
  default_ded_uctions?: number | string;
  paymentMethod?: string;
  payment_method?: string;
  walletNumber?: string;
  wallet_number?: string;
  bankAccount?: string;
  bank_account?: string;
  assistantOfBarberId?: number | string;
  assistant_of_barber_id?: number | string;
  assistantTasksJson?: unknown[];
  assistant_tasks_json?: unknown[];
  receivesCommission?: boolean;
  receives_commission?: boolean;
  assistantCommissionRate?: number | string;
  assistant_commission_rate?: number | string;
  hasLoginAccount?: boolean;
  has_login_account?: boolean;
  username?: string;
  password?: string;
  user_id?: number | string;
  services?: { id: number | string }[];
  serviceIds?: (number | string)[];
  [key: string]: unknown;
}

/**
 * Managed user row (moved from pages/owner/PermissionsManagement.tsx).
 */
export interface ManagedUser {
  id: string | number;
  fullName?: string;
  username?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
  phone?: string;
  specialty?: string;
}

export interface DocumentRecord {
    id?: number | string;
    employee_id?: number | string;
    employeeId?: number | string;
    employeeName?: string;
    title?: string;
    file_type?: string;
    document_type?: string;
    documentType?: string;
  file_url?: string;
  fileUrl?: string;
  issue_date?: string;
  issueDate?: string;
  expiry_date?: string;
  expiryDate?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  [key: string]: unknown;
}
