import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { audioCatalogPlugin } from "./scripts/audio-catalog.js";
import { projectConfigPlugin } from "./scripts/project-config.js";
export default defineConfig({
  plugins: [projectConfigPlugin(fileURLToPath(new URL(".", import.meta.url))), audioCatalogPlugin(fileURLToPath(new URL("./public/audio", import.meta.url)))],
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        game: fileURLToPath(new URL("./index.html", import.meta.url)),
        config: fileURLToPath(new URL("./config.html", import.meta.url)),
        audio: fileURLToPath(new URL("./audio.html", import.meta.url)),
      },
    },
  },
});
