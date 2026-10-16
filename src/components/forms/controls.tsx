import { useEffect, useState, type ReactNode } from "react";

/** A label with its input and, when the value is wrong, the message underneath. */
export const Field = ({ label, error, children }: { label: ReactNode; error?: string; children: ReactNode }) => (
  <label>
    {label}
    {children}
    {error ? <span className="ferr">{error}</span> : null}
  </label>
);

/** A tick box with its text. */
export const Check = ({ children, ...rest }: { children: ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="chk">
    <input type="checkbox" {...rest} />
    {children}
  </label>
);

export type Option = string | [value: string, text: string];
const optionValue = (o: Option) => (Array.isArray(o) ? o[0] : o);
const optionText = (o: Option) => (Array.isArray(o) ? o[1] : o);

export function Select({ options, ...rest }: { options: Option[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest}>
      {options.map((o) => (
        <option key={optionValue(o)} value={optionValue(o)}>
          {optionText(o)}
        </option>
      ))}
    </select>
  );
}

/** What a photo/file picker holds: a newly chosen file and whether the saved one was removed. */
export interface FileSlotValue {
  file: File | null;
  cleared: boolean;
}
export const emptySlot: FileSlotValue = { file: null, cleared: false };

/**
 * A picture or file that is saved with the form: shows the current one with a Remove button, and a picker to add or replace it.
 * The parent keeps the value and decides what to upload when the form is saved.
 */
export function FileSlot({
  value,
  onChange,
  currentUrl,
  label,
  accept,
  kind = "image",
  removable = true
}: {
  value: FileSlotValue;
  onChange: (v: FileSlotValue) => void;
  currentUrl?: string | null;
  label: string;
  accept: string;
  kind?: "image" | "file";
  removable?: boolean;
}) {
  const [resetKey, setResetKey] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!value.file || kind !== "image") return setPreview(null);
    const url = URL.createObjectURL(value.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file, kind]);

  const shown = value.cleared ? null : currentUrl;
  return (
    <div>
      {kind === "image" ? (
        <div className="thumbs">
          {preview ? (
            <div>
              <img src={preview} alt="New photo" />
            </div>
          ) : shown ? (
            <div>
              <a href={shown} target="_blank" rel="noopener noreferrer">
                <img src={shown} alt="Current photo" />
              </a>
              {removable && (
                <button
                  type="button"
                  className="danger sm"
                  onClick={() => {
                    setResetKey((k) => k + 1);
                    onChange({ file: null, cleared: true });
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ) : (
            <p className="mut">{value.cleared ? "The photo will be removed when you save." : "No photo yet."}</p>
          )}
        </div>
      ) : (
        <p className="mut">
          {shown ? (
            <>
              Current file:{" "}
              <a href={shown} target="_blank" rel="noopener noreferrer">
                open ↗
              </a>{" "}
              {removable && (
                <button
                  type="button"
                  className="danger sm"
                  onClick={() => {
                    setResetKey((k) => k + 1);
                    onChange({ file: null, cleared: true });
                  }}
                >
                  Remove file
                </button>
              )}
            </>
          ) : value.cleared ? (
            "The file will be removed when you save."
          ) : (
            "No file yet."
          )}
        </p>
      )}
      <label>
        {label}
        <input
          key={resetKey}
          type="file"
          accept={accept}
          onChange={(e) => onChange({ file: e.target.files?.[0] ?? null, cleared: false })}
        />
      </label>
    </div>
  );
}
