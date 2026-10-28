import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const configured = Boolean(url && publishableKey);
export const supabase = configured
  ? createClient(url, publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;

export function loginEmail(input: string): string {
  const value = input.trim();
  if (value.toLowerCase() === 'wahi_admin') {
    return import.meta.env.VITE_ADMIN_LOGIN_EMAIL || '';
  }
  const alias = import.meta.env.VITE_PARTNER_LOGIN_ALIAS || '';
  if (alias && value.toLowerCase() === alias.toLowerCase()) {
    return import.meta.env.VITE_PARTNER_LOGIN_EMAIL || '';
  }
  return value;
}
