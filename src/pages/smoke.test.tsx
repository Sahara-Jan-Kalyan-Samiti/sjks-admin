import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pages } from "@/app/navigation";
import { ConfirmProvider, ToastProvider } from "@/components/ui/feedback";
import { makeSupabaseStub } from "@/test/supabaseStub";

vi.mock("@/lib/supabase", () => ({
  supabase: makeSupabaseStub(),
  supabaseConfigured: true,
  supabaseUrl: "https://x.supabase.co",
  supabaseKey: "k"
}));
vi.mock("@/auth/AuthProvider", () => {
  const me = {
    id: "u1",
    email: "admin@example.org",
    display_name: "Admin",
    role: "admin",
    is_active: true,
    last_login_at: null,
    created_at: "2026-01-01",
    photo_path: null
  };
  return {
    useMe: () => me,
    useAuth: () => ({
      state: { status: "signedIn", me },
      signIn: async () => undefined,
      signOut: async () => undefined,
      refresh: async () => undefined
    })
  };
});

afterEach(cleanup);

/** Every screen must open, finish loading and show its empty state without crashing (the database answers "no rows"). */
describe("screens open without errors", () => {
  for (const page of pages) {
    it(`${page.label} (/${page.path})`, async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { container } = render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/" + page.path]}>
            <ToastProvider>
              <ConfirmProvider>
                <Suspense fallback={<div className="loading" />}>
                  <page.Component />
                </Suspense>
              </ConfirmProvider>
            </ToastProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );
      await waitFor(() => expect(container.querySelector(".loading")).toBeNull(), { timeout: 4000 });
      expect(container.querySelector("h1")).not.toBeNull();
      expect(container.querySelector(".msg.err")?.textContent ?? "").toBe("");
    });
  }
});
