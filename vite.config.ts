import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

function resolveBuildId(): string {
  const env = process.env.GITHUB_SHA || process.env.VITE_BUILD_ID || "";
  if (env) return env.slice(0, 12);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

function cacheBustPlugin(buildId: string): Plugin {
  return {
    name: "cache-bust",
    transformIndexHtml(html) {
      return html
        .replaceAll("__BUILD_ID__", buildId)
        .replace("</head>", `    <meta name="build-id" content="${buildId}" />\n  </head>`);
    },
    writeBundle(options) {
      const dir = options.dir ?? resolve(process.cwd(), "dist");
      writeFileSync(resolve(dir, "version.txt"), `${buildId}\n`, "utf8");
    },
  };
}

const buildId = resolveBuildId();

export default defineConfig({
  base: "/grokbot-mercadinho/",
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [cacheBustPlugin(buildId)],
  resolve: {
    alias: {
      three: fileURLToPath(new URL("./public/js/vendor/three.module.js", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ["three"],
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
    build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("three")) return "three";
        },
      },
    },
  },
});
