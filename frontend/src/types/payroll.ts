/**
 * Payroll domain types (moved from pages/owner/Payroll.tsx).
 */

export interface PayrollRecord {
  id?: number | string;
  employee_id?: number | string;
  employeeId?: number | string;
  employee_name_snapshot?: string;
  role_snapshot?: string;
  net_salary?: number;
  base_salary?: number;
  commission_amount?: number;
  bonus_amount?: number;
  deduction_amount?: number;
  advance_amount?: number;
  payment_method?: string;
  notes?: string;
  status?: string;
  period_month?: number;
  period_year?: number;
  [key: string]: unknown;
}

export interface AdvanceRecord {
  id?: number | string;
  employee_id?: number | string;
  amount?: number;
  description?: string;
  advance_date?: string;
  is_deducted?: boolean;
  [key: string]: unknown;
}

export interface PayrollSummary {
  total_payroll: number;
  total_employees: number;
  total_base_salary?: number;
  total_commissions?: number;
  total_bonuses?: number;
  total_deductions?: number;
  total_advances?: number;
  employees_count?: number;
  [key: string]: unknown;
}

export interface Period {
  month: number;
  year: number;
}

export interface PayData {
  payment_method: string;
  notes: string;
}

export interface AdvanceData {
  employee_id: string;
  amount: string;
  description: string;
  advance_date: string;
}

export interface EditData {
  base_salary: number;
  commission_amount: number;
  bonus_amount: number;
  deduction_amount: number;
  advance_amount: number;
  payment_method: string;
  notes: string;
}
