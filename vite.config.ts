import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig, loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa"

import { viteRenderBaseConfig } from "./configs/vite.render.config"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

const ROOT = "./apps/renderer"

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd())

  return defineConfig({
    ...viteRenderBaseConfig,
    root: ROOT,
    envDir: resolve(__dirname, "."),
    build: {
      outDir: resolve(__dirname, "out/web"),
      target: "ES2022",

      rollupOptions: {
        input: {
          main: resolve(ROOT, "/index.html"),
          __debug_proxy: resolve(ROOT, "/__debug_proxy.html"),
        },
      },
    },
    server: {
      port: 2233,
      watch: {
        ignored: ["**/dist/**", "**/out/**", "**/public/**", ".git/**"],
      },
      ...(env.VITE_DEV_PROXY
        ? {
            proxy: {
              [env.VITE_DEV_PROXY]: {
                target: env.VITE_DEV_PROXY_TARGET,
                changeOrigin: true,
                rewrite: (path) => path.replace(new RegExp(`^${env.VITE_DEV_PROXY}`), ""),
              },
            },
          }
        : {}),
    },
    resolve: {
      alias: {
        ...viteRenderBaseConfig.resolve?.alias,
        "@follow/logger": resolve(__dirname, "./packages/logger/web.ts"),
      },
    },
    plugins: [
      ...((viteRenderBaseConfig.plugins ?? []) as any),
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "prompt",
        injectRegister: false,

        injectManifest: {
          globPatterns: [
            "**/*.{js,json,css,html,txt,svg,png,ico,webp,woff,woff2,ttf,eot,otf,wasm}",
          ],
        },
        // workbox: {
        //   globPatterns: [
        //     "**/*.{js,json,css,html,txt,svg,png,ico,webp,woff,woff2,ttf,eot,otf,wasm}",
        //   ],
        //   cleanupOutdatedCaches: true,
        //   clientsClaim: true,
        // },

        manifest: {
          theme_color: "#000000",
          name: "Follow",
          display: "standalone",
          background_color: "#ffffff",
          icons: [
            {
              src: "pwa-64x64.png",
              sizes: "64x64",
              type: "image/png",
            },
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },

        devOptions: {
          enabled: false,
          navigateFallback: "index.html",
          suppressWarnings: true,
          type: "module",
        },
      }),
    ],

    define: {
      ...viteRenderBaseConfig.define,
      ELECTRON: "false",
    },
  })
}
