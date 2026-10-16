import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/auth/LoginPage";
import { useAuth } from "@/auth/AuthProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Msg, Spinner } from "@/components/ui/primitives";
import { supabaseConfigured } from "@/lib/supabase";
import { pages } from "./navigation";

export default function App() {
  const { state } = useAuth();

  if (!supabaseConfigured) {
    return (
      <div className="login">
        <div className="panel">
          <h1>Setup needed</h1>
          <Msg kind="err">
            Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example) and rebuild.
          </Msg>
        </div>
      </div>
    );
  }
  if (state.status === "loading") return <Spinner />;
  if (state.status === "signedOut") return <LoginPage notice={state.error} />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {pages.map(({ path, Component }) => (
          <Route key={path} path={`${path}/*`} element={<Component />} />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
