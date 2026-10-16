import { useState, type FormEvent } from "react";
import { Button, Msg } from "@/components/ui/primitives";
import { LanguageSwitch } from "@/i18n/LangProvider";
import { messageOf } from "@/lib/errors";
import { useAuth } from "./AuthProvider";

export function LoginPage({ notice }: { notice?: string }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(messageOf(err));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <h1>Admin sign in</h1>
        {(error || notice) && <Msg kind="err">{error || notice}</Msg>}
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Button type="submit" busy={busy} busyText="Signing in…">
          Sign in
        </Button>
        <p className="mut">Powered by Supabase Auth</p>
        <LanguageSwitch />
      </form>
    </div>
  );
}
