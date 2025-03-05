import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "src",
  base: "/",
  publicDir: "../public",
  build: {
    outDir: "../dist",
  },
  plugins: [tailwindcss()],
});
