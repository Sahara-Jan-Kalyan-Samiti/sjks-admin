import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** False when the two public variables are missing: the app then shows a setup message instead of failing in the console. */
export const supabaseConfigured = Boolean(url && key);
export const supabaseUrl = url ?? "";
export const supabaseKey = key ?? "";

/**
 * The one Supabase client of the admin panel. It uses the URL and the PUBLISHABLE key only; what a signed-in staff member
 * can read or change is decided by Row Level Security in the database (sjks-database), not by hiding the key.
 * Never put a service-role key in a VITE_ variable.
 */
export const supabase = createClient(supabaseConfigured ? url! : "http://localhost:54321", supabaseConfigured ? key! : "missing-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
