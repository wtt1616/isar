export type UserRole = 'admin' | 'head_imam' | 'imam' | 'bilal' | 'inventory_staff' | 'bendahari';
export type PrayerTime = 'Subuh' | 'Zohor' | 'Asar' | 'Maghrib' | 'Isyak';

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Availability {
  id: number;
  user_id: number;
  date: string;
  prayer_time: PrayerTime;
  is_available: boolean;
  reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Schedule {
  id: number;
  date: string;
  prayer_time: PrayerTime;
  imam_id: number;
  bilal_id: number;
  week_number: number;
  year: number;
  is_auto_generated: boolean;
  created_by?: number;
  modified_by?: number;
  created_at: Date;
  updated_at: Date;
  imam_name?: string;
  bilal_name?: string;
}

export interface WeekSchedule {
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  schedules: Schedule[];
}

export interface Inventory {
  id: number;
  no_siri_pendaftaran: string;
  keterangan: string;
  cara_diperolehi: string;
  created_by?: number;
  modified_by?: number;
  created_at: Date;
  updated_at: Date;
  creator_name?: string;
  modifier_name?: string;
}

export interface HartaModal {
  id: number;
  no_siri_pendaftaran: string;
  keterangan: string;
  cara_diperolehi: string;
  created_by?: number;
  modified_by?: number;
  created_at: Date;
  updated_at: Date;
  creator_name?: string;
  modifier_name?: string;
}

export interface Preacher {
  id: number;
  name: string;
  photo?: string;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

// Financial Management Types
export type TransactionType = 'penerimaan' | 'pembayaran' | 'uncategorized';

export type PenerimaanCategory =
  | 'Sumbangan Am'
  | 'Sumbangan Khas (Amanah)'
  | 'Hasil Sewaan/Penjanaan Ekonomi'
  | 'Tahlil'
  | 'Sumbangan Elaun'
  | 'Hibah Pelaburan'
  | 'Deposit'
  | 'Hibah Bank'
  | 'Lain-lain Terimaan';

export type PembayaranCategory =
  | 'Pentadbiran'
  | 'Pengurusan Sumber Manusia'
  | 'Pembangunan dan Penyelenggaraan'
  | 'Dakwah dan Pengimarahan'
  | 'Khidmat Sosial dan Kemasyarakatan'
  | 'Pembelian Aset'
  | 'Perbelanjaan Khas (Amanah)'
  | 'Pelbagai';

export interface BankStatement {
  id: number;
  filename: string;
  upload_date: Date;
  month: number;
  year: number;
  uploaded_by: number;
  total_transactions: number;
  categorized_count: number;
  uploader_name?: string;
}

export interface FinancialTransaction {
  id: number;
  statement_id: number;
  transaction_date: Date;
  customer_eft_no?: string;
  transaction_code?: string;
  transaction_description?: string;
  ref_cheque_no?: string;
  servicing_branch?: string;
  debit_amount?: number;
  credit_amount?: number;
  balance: number;
  sender_recipient_name?: string;
  payment_details?: string;
  transaction_type: TransactionType;
  category_penerimaan?: PenerimaanCategory;
  category_pembayaran?: PembayaranCategory;
  notes?: string;
  categorized_by?: number;
  categorized_at?: Date;
  created_at: Date;
}
