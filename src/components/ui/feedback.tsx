import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------------------------------------------------
// Toasts: short messages in the corner.  const toast = useToast();  toast("Saved."); toast(error.message, "err");
// ---------------------------------------------------------------------------------------------------------------------
type ToastKind = "ok" | "err";
interface ToastItem {
  id: number;
  text: string;
  kind: ToastKind;
  out: boolean;
}
const ToastContext = createContext<(text: string, kind?: ToastKind) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const push = useCallback((text: string, kind: ToastKind = "ok") => {
    const id = next.current++;
    setItems((l) => [...l, { id, text, kind, out: false }]);
    setTimeout(() => setItems((l) => l.map((t) => (t.id === id ? { ...t, out: true } : t))), kind === "err" ? 6000 : 3500);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), (kind === "err" ? 6000 : 3500) + 300);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`toast ${t.kind}${t.out ? " out" : ""}`} role={t.kind === "err" ? "alert" : "status"}>
              {t.text}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Confirmation dialog:  const confirm = useConfirm();  if (await confirm({ title, text, ok: "Delete", danger: true })) ...
// ---------------------------------------------------------------------------------------------------------------------
export interface ConfirmOptions {
  title?: string;
  text?: string;
  ok?: string;
  danger?: boolean;
}
const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ options, resolve })), []);
  const done = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && done(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const { title = "Are you sure?", text = "", ok = "Confirm", danger = false } = state?.options ?? {};
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state &&
        createPortal(
          <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && done(false)} style={{ zIndex: 50 }}>
            <div className="panel dialog" role="alertdialog" aria-modal="true" aria-label={title}>
              <h2>{title}</h2>
              {text && <p>{text}</p>}
              <div className="row end">
                <button type="button" className="ghost" autoFocus onClick={() => done(false)}>
                  Cancel
                </button>
                <button type="button" className={danger ? "danger solid" : ""} onClick={() => done(true)}>
                  {ok}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}
