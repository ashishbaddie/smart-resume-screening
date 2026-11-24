import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In development the React app calls /api/... and Vite forwards it to the FastAPI server,
// so the browser never needs CORS. In production nginx does the same (see nginx.conf).
export default defineConfig({
  base: "/smart-resume-screening/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    restoreMocks: true,
  },
});
