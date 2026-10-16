import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmProvider, ToastProvider } from "@/components/ui/feedback";
import { makeSupabaseStub } from "@/test/supabaseStub";

const donation = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  created_at: "2026-09-01T10:00:00Z",
  donated_at: "2026-09-01",
  mode: "offline",
  method: "Cash",
  status: "success",
  amount: 1500,
  currency: "INR",
  donor_name: `Donor ${id}`,
  donor_email: null,
  donor_pan: null,
  purpose: "Education",
  ...over
});

vi.mock("@/lib/supabase", () => ({
  supabase: makeSupabaseStub({ donations: [donation(42), donation(43, { amount: 250, status: "pending", method: "UPI (direct)" })] }),
  supabaseConfigured: true
}));

const { default: Donations } = await import("./index");

afterEach(cleanup);
const open = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <Donations />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

describe("Donations screen", () => {
  it("lists donations with their receipt numbers and totals only the successful ones", async () => {
    open();
    await screen.findByText("Donor 42");
    expect(screen.getByText("SJKS/2026-27/00042")).toBeTruthy();
    expect(screen.getByText("Donor 43")).toBeTruthy();
    // 1,500 successful; the pending 250 is listed but not counted as raised
    expect(screen.getByText(/2 donation record\(s\) · ₹1,500 raised from 1 successful/)).toBeTruthy();
  });

  it("opens a donation and explains that receipts need the backend when it is not connected", async () => {
    open();
    fireEvent.click(await screen.findByText("Donor 42"));
    const dialog = await screen.findByRole("dialog", { name: "Donation" });
    expect(within(dialog).getByText("Receipts & certificates")).toBeTruthy();
    expect(within(dialog).getByText(/Set VITE_API_URL/)).toBeTruthy();
    expect((within(dialog).getByText("Print receipt") as HTMLButtonElement).disabled).toBe(true);
    // Escape closes it
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("checks the form before recording an offline donation", async () => {
    open();
    fireEvent.click(await screen.findByText("+ Record offline donation"));
    const dialog = await screen.findByRole("dialog", { name: "Record offline donation" });
    fireEvent.change(within(dialog).getByLabelText(/PAN/), { target: { value: "bad" } });
    fireEvent.click(within(dialog).getByText("Record donation"));
    expect(await within(dialog).findByText("Donor name is required")).toBeTruthy();
    expect(within(dialog).getByText("Amount is required")).toBeTruthy();
    expect(within(dialog).getByText("PAN must look like ABCDE1234F")).toBeTruthy();
  });
});
