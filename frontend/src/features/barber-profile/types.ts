export interface BarberProfileForm {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  bio: string;
  commission_rate: number;
  avatar_url: string;
}

export interface NotificationsState {
  new_appointment: boolean;
  appointment_reminder: boolean;
  appointment_cancelled: boolean;
  shift_reminder: boolean;
  tips: boolean;
  marketing: boolean;
}

export type NotificationKey = keyof NotificationsState;

export interface SecurityState {
  current_password: string;
  new_password: string;
  confirm_password: string;
  two_factor: boolean;
}

export interface AppearanceState {
  theme: string;
  compact_mode: boolean;
  animations: boolean;
  sound: boolean;
}
