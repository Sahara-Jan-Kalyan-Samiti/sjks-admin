import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AuthError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { AdminProfile } from "@/types";

export interface Me extends AdminProfile {
  email: string;
}
type State = { status: "loading" } | { status: "signedOut"; error?: string } | { status: "signedIn"; me: Me };

interface Ctx {
  state: State;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads the profile (after the admin changed their own photo). */
  refresh: () => Promise<void>;
}
const AuthContext = createContext<Ctx | null>(null);

/** The signed-in person, or a thrown AuthError. Only an *active* row in admin_profiles may use the panel. */
async function loadAdmin(session: Session): Promise<Me> {
  const user = session.user;
  const { data, error } = await supabase.from("admin_profiles").select("*").eq("id", user.id).eq("is_active", true).maybeSingle();
  if (error || !data) throw new AuthError("This account is not an admin, or has been deactivated.");
  // remember the last sign-in and the e-mail on the profile (fire and forget)
  void supabase
    .from("admin_profiles")
    .update({ last_login_at: new Date().toISOString(), email: user.email })
    .eq("id", user.id)
    .then(() => undefined);
  return { ...(data as AdminProfile), email: user.email ?? "" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const resolve = useCallback(async (session: Session | null) => {
    if (!session) return setState({ status: "signedOut" });
    try {
      setState({ status: "signedIn", me: await loadAdmin(session) });
    } catch (e) {
      await supabase.auth.signOut();
      setState({ status: "signedOut", error: e instanceof Error ? e.message : "Could not sign in." });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setState({ status: "signedOut" });
      else if (event === "TOKEN_REFRESHED" && !session) setState({ status: "signedOut" });
    });
    return () => data.subscription.unsubscribe();
  }, [resolve]);

  // another page found the session ended (a 401 from the backend)
  useEffect(() => {
    const onOut = () => setState({ status: "signedOut", error: "Your session has ended. Please sign in again." });
    window.addEventListener("admin:signed-out", onOut);
    return () => window.removeEventListener("admin:signed-out", onOut);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new AuthError(error.message);
      await resolve(data.session);
    },
    [resolve]
  );
  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => undefined);
    setState({ status: "signedOut" });
  }, []);
  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) await resolve(data.session);
  }, [resolve]);

  return <AuthContext.Provider value={{ state, signIn, signOut, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
/** The signed-in admin. Only call it on screens shown after sign-in. */
export function useMe(): Me {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("useMe: not signed in");
  return state.me;
}
