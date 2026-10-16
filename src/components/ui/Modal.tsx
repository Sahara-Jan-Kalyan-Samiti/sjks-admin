import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Only the top-most dialog reacts to Escape.
const stack: symbol[] = [];

/** A dialog over the page. Closes on Escape, on the Close button and on a click outside. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const id = Symbol("modal");
    stack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stack[stack.length - 1] === id) close.current();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]),select,textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(id), 1);
    };
  }, []);

  return createPortal(
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel" role="dialog" aria-modal="true" aria-label={title} ref={panel}>
        <div className="row">
          <h2 className="grow">{title}</h2>
          <button className="ghost sm" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
