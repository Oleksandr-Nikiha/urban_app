export interface UserProfile {
  id?: number;
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  street: string;
  house: string;
  apartment: string;
  additional_address?: string;
  telegram_id?: number | null;
  username?: string | null;
  avatar_url?: string | null;
  is_phone_verified?: boolean;
  client_code?: string;
  bonuses: number;
  isAuthenticated?: boolean;
}

// --- Синхронізовані контракти API (api/src/schemas/user.py, auth.py, bonus.py) ---

export interface UserOut {
  id: number;
  telegram_id: number | null;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone: string;
  is_phone_verified: boolean;
  delivery_address: string | null;
  additional_address?: string | null;
  client_code?: string | null;
  bonus_balance: number;
  bot_username?: string | null;
  auth_token?: string | null;
}

export interface TelegramWidgetAuthPayload {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  auth_date: number;
  hash: string;
}

export interface PhoneLoginPayload {
  phone: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  telegram_id?: number | null;
}

export interface WebProfileUpdatePayload {
  telegram_id?: number | null;
  phone?: string | null;
  full_name?: string | null;
  delivery_address?: string | null;
  additional_address?: string | null;
  bonus_balance?: number | null;
}

export interface BonusTransaction {
  id: number;
  user_id: number;
  order_id: number | null;
  amount: number;
  balance_after: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
}

export const USER_PROFILE_STORAGE_KEY = "urban_user_profile_v1";
export const LEGACY_PROFILE_STORAGE_KEY = "doma_user_profile_v1";

export function isUserAuthenticated(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.isAuthenticated ||
    profile.telegram_id ||
    (profile.is_phone_verified && profile.phone) ||
    (profile.phone && profile.phone.length >= 10)
  );
}

export function getSharedCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setSharedCookie(name: string, value: string, days = 365): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Lax`;
}

export function deleteSharedCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function loadSavedProfile(): UserProfile | null {
  try {
    const raw =
      localStorage.getItem(USER_PROFILE_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}
  return null;
}

export function saveSharedProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    if (profile.phone) setSharedCookie("urban_auth_phone", profile.phone);
    if (profile.telegram_id) setSharedCookie("urban_auth_tg", String(profile.telegram_id));
  } catch {}
}

export function clearSharedProfile(): void {
  try {
    localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    localStorage.removeItem(LEGACY_PROFILE_STORAGE_KEY);
    deleteSharedCookie("urban_auth_phone");
    deleteSharedCookie("urban_auth_tg");
  } catch {}
}
