import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, Msg } from "@/components/ui/primitives";
import { LanguageSwitch } from "@/i18n/LangProvider";
import { messageOf } from "@/lib/errors";
import { useAuth } from "./AuthProvider";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 6;
const MAX_TRIES = 5;
const LOCK_SECONDS = 30;

type Field = "email" | "password";

function checkEmail(v: string): string {
  if (!v.trim()) return "Email is required";
  if (!EMAIL_RE.test(v.trim())) return "Enter a valid email address";
  return "";
}
function checkPassword(v: string): string {
  if (!v) return "Password is required";
  if (v.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`;
  return "";
}

const Eye = ({ off }: { off: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

export function LoginPage({ notice }: { notice?: string }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [touched, setTouched] = useState<Record<Field, boolean>>({ email: false, password: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tries, setTries] = useState(0);
  const [lock, setLock] = useState(0); // seconds left before another attempt is allowed

  // count the lock-out down once a second
  useEffect(() => {
    if (lock <= 0) return;
    const id = window.setTimeout(() => setLock((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [lock]);

  const errors: Record<Field, string> = { email: checkEmail(email), password: checkPassword(password) };
  const shown = (f: Field) => (touched[f] ? errors[f] : "");

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState("CapsLock"));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || lock > 0) return;
    setTouched({ email: true, password: true });
    if (errors.email || errors.password) {
      setError(null);
      document.getElementById(errors.email ? "login-email" : "login-password")?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(messageOf(err));
      setPassword("");
      setTouched((t) => ({ ...t, password: false }));
      const n = tries + 1;
      if (n >= MAX_TRIES) {
        setTries(0);
        setLock(LOCK_SECONDS);
      } else setTries(n);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="panel login-card" onSubmit={submit} noValidate>
        <img className="login-logo" src="/assets/images/logo.png" alt="Sahara" />
        <h1>Admin sign in</h1>
        <p className="login-sub">Sign in to manage the website, donations and members.</p>

        {(error || notice) && <Msg kind="err">{error || notice}</Msg>}
        {lock > 0 && (
          <Msg kind="info">
            Too many failed attempts. Try again in {lock} seconds.
          </Msg>
        )}

        <label htmlFor="login-email">
          Email
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={!!shown("email")}
            aria-describedby={shown("email") ? "login-email-err" : undefined}
            autoFocus
          />
        </label>
        {shown("email") && (
          <p id="login-email-err" className="login-err" role="alert">
            {shown("email")}
          </p>
        )}

        <label htmlFor="login-password">
          Password
          <span className="login-pw">
            <input
              id="login-password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => {
                setTouched((t) => ({ ...t, password: true }));
                setCaps(false);
              }}
              onKeyUp={onKey}
              onKeyDown={onKey}
              aria-invalid={!!shown("password")}
              aria-describedby={shown("password") ? "login-password-err" : undefined}
            />
            <button
              type="button"
              className="login-eye"
              aria-label={show ? "Hide password" : "Show password"}
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              <Eye off={show} />
            </button>
          </span>
        </label>
        {shown("password") && (
          <p id="login-password-err" className="login-err" role="alert">
            {shown("password")}
          </p>
        )}
        {caps && <p className="login-warn">Caps Lock is on</p>}

        <Button type="submit" className="login-submit" busy={busy} busyText="Signing in…" disabled={lock > 0}>
          Sign in
        </Button>
        <p className="mut login-foot">Powered by Supabase Auth</p>
        <LanguageSwitch />
      </form>
    </div>
  );
}
