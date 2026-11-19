import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
    minify: "terser",
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("/three/") ? "three" : undefined),
      },
    },
  },
  server: {
    port: 8080,
    open: false,
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
