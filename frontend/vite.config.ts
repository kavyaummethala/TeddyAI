import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // All /api calls go to the Express backend so API keys never touch the browser.
    proxy: { "/api": "http://localhost:8787" },
    fs: { allow: [".."] }, // lets the frontend import ../shared/types.ts
  },
});
