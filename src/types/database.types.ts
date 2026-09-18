export type UserRole = 'admin' | 'auditor' | 'missionary';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type PeriodStatus = 'OPEN' | 'UNDER_REVIEW' | 'REVIEWED' | 'READY_FOR_SUBMISSION' | 'LOCKED';
export type DuplicateReceiptRule = 'ALLOWED' | 'WARNING' | 'BLOCKED';

export interface Church {
  id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  church_id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface FinancialYear {
  id: string;
  church_id: string;
  year: number;
  approved_budget: number;
  category_targets: Record<string, number>; // NEW: Stores { category_id: target_amount }
  is_closed: boolean;
  created_at: string;
}

export interface FinancialPeriod {
  id: string;
  church_id: string;
  financial_year_id: string;
  month: number;
  period_name: string;
  status: 'OPEN' | 'CLOSED' | 'LOCKED';
  beginning_balance: number;
  cib_savings: number;
  cib_current: number;
  cib_time_deposit: number;
  coh_petty_cash: number;
  coh_undeposited: number;
  coh_advances: number;
  created_at: string;
}

export interface Category {
  id: string;
  church_id: string;
  type: TransactionType;
  export_code: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  church_id: string;
  financial_period_id: string;
  category_id: string | null; // Allows null for unassigned transactions
  date: string;
  type: TransactionType;
  amount: number;
  receipt_no: string | null;
  payee_name: string | null;
  remarks: string | null;
  receipt_url: string | null;
  receipt_exempt: boolean;
  entered_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  church_id: string;
  record_id: string;
  entity: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changed_by: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

export interface ExportTemplate {
  id: string;
  church_id: string;
  name: string;
  transaction_type: TransactionType | null;
  visible_columns: string[];
  column_order: string[];
  date_format: string;
  currency_format: string;
  sheet_name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExportHistory {
  id: string;
  church_id: string;
  financial_period_id: string | null;
  template_name: string;
  record_count: number;
  total_amount: number;
  exported_by: string;
  filters_applied: Record<string, unknown> | null;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  church_id: string;
  strict_amount_mode: boolean;
  duplicate_receipt_behavior: DuplicateReceiptRule;
  created_at: string;
  updated_at: string;
}

export interface CoopWeeklyLog {
  id: string;
  date: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  remarks: string;
  encoded_by: string;
}

export interface CoopMonthlyLog {
  id: string;
  church_id: string;
  financial_period_id: string;
  month: number;
  beginning_balance: number;
  deposit: number; 
  withdrawal: number;
  weekly_logs: CoopWeeklyLog[];
  interest_rate: number;
  interest_earned: number;
  ending_balance: number;
  rate_updated_by: string | null;
  created_at: string;
}