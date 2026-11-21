import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// in development the backend runs on :8000, so forward API and WebSocket calls to it
const backend = process.env.BACKEND_URL || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": backend,
      "/ws": { target: backend.replace("http", "ws"), ws: true },
    },
  },
});
