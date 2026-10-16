import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Admin panel only. The public website (sjks-frontend) and the API (sjks-backend) are separate repositories.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { port: 5174 },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"]
        }
      }
    }
  }
});
