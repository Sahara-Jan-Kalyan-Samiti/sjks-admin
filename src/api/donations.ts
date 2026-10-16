import { supabase } from "@/lib/supabase";
import { unwrap } from "@/lib/errors";
import { backend, backendBlobUrl, backendDownload } from "@/lib/backend";
import { fileStamp } from "@/lib/export";
import type { Donation } from "@/types";
import { crud } from "./crud";

const rows = crud<Donation>("donations");

/** SJKS/2026-27/00042: the same numbering the backend prints on receipts. */
export function receiptNo(d: Pick<Donation, "id" | "donated_at">, tax = false): string {
  const date = new Date(d.donated_at);
  const y = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return `SJKS/${tax ? "TAX/" : ""}${y}-${String((y + 1) % 100).padStart(2, "0")}/${String(d.id).padStart(5, "0")}`;
}

export async function getDonations(): Promise<Donation[]> {
  const data =
    unwrap(await supabase.from("donations").select("*").order("donated_at", { ascending: false }).order("id", { ascending: false })) ?? [];
  return (data as Donation[]).map((d) => ({ ...d, receipt_no: receiptNo(d) }));
}
export const createDonation = (data: Record<string, unknown>) => rows.create(data);
export const updateDonation = (id: number, data: Record<string, unknown>) => rows.update(id, data);

/** The printable receipt or 80G certificate, opened in a new tab (needs the backend). */
export async function openReceipt(id: number, type: "receipt" | "tax"): Promise<void> {
  const url = await backendBlobUrl(`/api/donations/${id}/receipt?type=${type}`);
  window.open(url, "_blank", "noopener");
}
/** E-mails the receipt to the donor (needs the backend and SMTP). */
export const emailReceipt = (id: number, type: "receipt" | "tax") =>
  backend(`/api/donations/${id}/send-receipt`, { method: "POST", body: { type } });
/** All donations as CSV, produced by the backend. */
export const downloadDonationsCsv = () => backendDownload("/api/exports/donations.csv", `donations-${fileStamp()}.csv`);
