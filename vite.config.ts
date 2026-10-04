import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Static build: everything is bundled into dist/ — no server, no backend.
// Relative base so the folder can be served from any path (Vercel, Netlify,
// GitHub Pages, or plain file hosting).
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
