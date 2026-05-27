import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    target: "node22",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["es"],
      fileName: () => "websearch.js",
    },
    rollupOptions: {
      external: [
        // Keep deps with Node.js built-in requirements external
        "jsdom",
        "commander",
      ],
      output: {
        banner: "#!/usr/bin/env node",
      },
    },
  },
});
