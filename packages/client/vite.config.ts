/// <reference types="vitest" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenvExpand from "dotenv-expand";
import { defineConfig, loadEnv } from "vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // This check is important!
  if (mode === "development") {
    const env = loadEnv(mode, process.cwd(), "");
    dotenvExpand.expand({ parsed: env });
  }

  return {
    test: {
      env: loadEnv(mode, process.cwd(), ""),
      environment: "jsdom",
      setupFiles: "./src/__tests__/setupTests.ts",
    },
    build: {
      target: "esnext",
      minify: 'esbuild',
      sourcemap: true,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        external: [
          "@safe-global/safe-apps-sdk",
          "@safe-global/safe-apps-provider",
        ],
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            web3: ['ethers', 'viem'],
            ui: ['@radix-ui/react-dialog', '@radix-ui/react-select']
          },
          globals: {
            "@safe-global/safe-apps-sdk": "SafeAppsSDK",
            "@safe-global/safe-apps-provider": "SafeAppsProvider",
          },
        },
      },
    },
    plugins: [
      mkcert(),
      tailwindcss(),
      react(),
      VitePWA({
        includeAssets: [
          "favicon.ico",
          "icon.png",
          "apple-icon.png",
          "images/*.png"
        ],
        injectRegister: "auto",
        registerType: "prompt",
        devOptions: {
          enabled: true,
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24
                }
              }
            }
          ]
        },
        manifest: {
          name: "Green Goods",
          short_name: "Green Goods",
          description: "Green Goods App",
          theme_color: "#ffffff",
          background_color: "#fff",
          display: "standalone",
          orientation: "portrait-primary",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "icon.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "icon.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },
      }),
    ],
    define: {
      global: {},
      __DEV__: JSON.stringify(mode === 'development'),
      __PROD__: JSON.stringify(mode === 'production'),
      "process.env": loadEnv(mode, process.cwd(), ""),
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, './src'),
        "@components": resolve(__dirname, './src/components'),
        "@utils": resolve(__dirname, './src/utils'),
        "@types": resolve(__dirname, './src/types'),
        "@config": resolve(__dirname, './src/config'),
        process: "process/browser",
        path: "path-browserify",
        os: "os-browserify",
        stream: "stream-browserify",
      },
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      open: false,
      cors: true,
      hmr: {
        overlay: true,
        port: 24678
      },
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/graphql': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/rpc': {
          target: 'http://localhost:8545',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rpc/, '')
        }
      },
      fs: {
        allow: ['..']
      }
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'ethers',
        'viem',
        '@radix-ui/react-dialog',
        '@radix-ui/react-select',
        '@tanstack/react-query'
      ],
      exclude: ['canvas'],
      esbuildOptions: {
        target: "esnext",
        define: {
          global: "globalThis",
        },
        supported: {
          bigint: true,
        },
      },
    },
    logLevel: 'info',
    clearScreen: false
  };
});
