export type UserRole = 'admin' | 'head_imam' | 'imam' | 'bilal';
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
