import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "lovelace-luma.js",
    },
    minify: "esbuild",
    sourcemap: true,
    target: "es2022",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
