/** A rule returns an error message, or null when the value is fine. `all` gives access to the other fields of the form. */
export type Rule = (value: string, all: Record<string, any>) => string | null;

export const rules = {
  required:
    (label: string, max?: number): Rule =>
    (v) =>
      !v ? `${label} is required` : max && v.length > max ? `${label} must be ${max} characters or fewer` : null,
  max:
    (label: string, max: number): Rule =>
    (v) =>
      v.length > max ? `${label} must be ${max} characters or fewer` : null,
  email: ((v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Enter a valid email address" : null)) as Rule,
  phone: ((v) => (v && !/^[\d+()\-.\s]{7,30}$/.test(v) ? "Enter a valid phone number" : null)) as Rule,
  wholeNumber:
    (label: string): Rule =>
    (v) =>
      v !== "" && !/^\d+$/.test(v) ? `${label} must be a whole number (0 or more)` : null,
  /** A money amount such as 2500 or 2500.50. */
  amount:
    (label: string, required = false): Rule =>
    (v) =>
      v === ""
        ? required
          ? `${label} is required`
          : null
        : !/^\d+(\.\d{1,2})?$/.test(v)
          ? `${label} must be a number such as 2500 or 2500.50`
          : v.length > 13
            ? `${label} is too large`
            : null,
  /** First rule that complains wins. */
  all:
    (...list: Rule[]): Rule =>
    (v, all) => {
      for (const r of list) {
        const e = r(v, all);
        if (e) return e;
      }
      return null;
    }
};
