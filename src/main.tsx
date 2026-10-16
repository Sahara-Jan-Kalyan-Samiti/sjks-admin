import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/app/App";
import { AuthProvider } from "@/auth/AuthProvider";
import { ConfirmProvider, ToastProvider } from "@/components/ui/feedback";
import { LangProvider } from "@/i18n/LangProvider";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/components.css";

// Lists are refreshed explicitly after a change (queryClient.invalidateQueries), so there is no refetch on every window focus.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <LangProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </LangProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
