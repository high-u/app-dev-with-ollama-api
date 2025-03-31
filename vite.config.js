import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // root: "src",
  // base: "/",
  // publicDir: "./public",
  // build: {
  //   outDir: "./dist",
  // },
  plugins: [tailwindcss()],
  define: {
    'global': {},
    'process.env': {},
    'Buffer': ['buffer', 'Buffer']
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  resolve: {
    alias: {
      buffer: 'buffer'
    }
  }
});
