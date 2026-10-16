import { useCallback, useState, type ChangeEvent } from "react";
import type { Rule } from "./rules";

type Values = Record<string, any>;
type Errors<T> = Partial<Record<keyof T, string>>;

/**
 * Form state with the same rules the old panel used: text boxes hold strings, tick boxes hold booleans.
 *
 *   const f = useForm({ name: "", published: true });
 *   <Field label="Name" error={f.errors.name}><input {...f.field("name")} /></Field>
 *   if (!f.validate({ name: rules.required("Name", 120) })) return;
 */
export function useForm<T extends Values>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors<T>>({});

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }, []);

  /** Props for an <input>, <textarea> or <select>. */
  const field = <K extends keyof T>(key: K) => ({
    name: String(key),
    value: (values[key] ?? "") as string | number,
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(key, e.target.value as T[K]),
    "aria-invalid": errors[key] ? (true as const) : undefined
  });
  /** Props for a tick box. */
  const check = <K extends keyof T>(key: K) => ({
    name: String(key),
    checked: Boolean(values[key]),
    onChange: (e: ChangeEvent<HTMLInputElement>) => set(key, e.target.checked as T[K])
  });

  /** Runs the rules, shows the messages under the fields and returns true when everything is fine. */
  const validate = (rules: Partial<Record<keyof T, Rule>>): boolean => {
    const next: Errors<T> = {};
    let ok = true;
    for (const key of Object.keys(rules) as (keyof T)[]) {
      const rule = rules[key];
      if (!rule) continue;
      const message = rule(String(values[key] ?? "").trim(), values);
      if (message) {
        next[key] = message;
        ok = false;
      }
    }
    setErrors(next);
    if (!ok) {
      // move to the first problem
      setTimeout(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus(), 0);
    }
    return ok;
  };

  return { values, set, setValues, errors, field, check, validate };
}
