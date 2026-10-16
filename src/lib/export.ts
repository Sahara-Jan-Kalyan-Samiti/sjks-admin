import { stamp } from "./format";

/** Saves text as a file in the browser. */
export function downloadText(content: string, fileName: string, type = "text/csv"): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
}

/** One CSV cell, quoted. A leading = + - @ is prefixed with ' so a spreadsheet never runs it as a formula. */
export const csvCell = (v: unknown): string => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
export const toCsv = (lines: unknown[][]): string => lines.map((l) => l.map(csvCell).join(",")).join("\n");

/**
 * Writes an Excel file. Every cell is stored as text, so a value starting with "=" can never run as a formula.
 * The library is loaded only when an export is requested.
 */
export async function exportExcel(opts: {
  sheet: string;
  fileName: string;
  head: string[];
  rows: unknown[][];
  widths: number[];
}): Promise<void> {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const head = opts.head.map((value) => ({ value, fontWeight: "bold" as const }));
  const lines = opts.rows.map((r) => r.map((value) => ({ type: String, value: String(value ?? "") })));
  await writeXlsxFile([head, ...lines] as never, {
    columns: opts.widths.map((width) => ({ width })),
    sheet: opts.sheet,
    stickyRowsCount: 1,
    fileName: opts.fileName
  });
}

export const fileStamp = (): string => stamp(new Date()).slice(0, 10);
