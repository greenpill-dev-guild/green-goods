import { readdirSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "wxt";

// The ONNX runtime's WebAssembly must ship inside the extension: MV3 pages cannot load it from a
// CDN. Resolve it through Transformers.js so the copied files match the runtime it bundles.
function onnxRuntimeDist(): string {
  const requireFromHere = createRequire(import.meta.url);
  const transformersEntry = realpathSync(requireFromHere.resolve("@huggingface/transformers"));
  const runtimeEntry = realpathSync(createRequire(transformersEntry).resolve("onnxruntime-web"));
  return dirname(runtimeEntry);
}

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  outDir: ".output",
  manifest: {
    name: "Grove G0 feasibility spike",
    description: "Disposable spike: a graph tab, a Gemma worker, a Pi Durable task and a WebMCP content script.",
    permissions: ["storage"],
    host_permissions: ["https://huggingface.co/*", "https://*.huggingface.co/*", "https://*.hf.co/*"],
    action: { default_title: "Open the Grove G0 graph" },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self';",
    },
    cross_origin_embedder_policy: { value: "credentialless" },
    cross_origin_opener_policy: { value: "same-origin" },
  },
  hooks: {
    "build:publicAssets": (_wxt, files) => {
      const dist = onnxRuntimeDist();
      for (const file of readdirSync(dist)) {
        if (/^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(file)) {
          files.push({ absoluteSrc: join(dist, file), relativeDest: `ort/${file}` });
        }
      }
    },
  },
});
