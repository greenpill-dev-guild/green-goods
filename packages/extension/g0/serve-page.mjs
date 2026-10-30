// A loopback static server for g0/webmcp-page. 127.0.0.1 is a potentially trustworthy origin, so
// document.modelContext is exposed there when the WebMCP flag is on.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "webmcp-page");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json" };

export function servePage(port = 0) {
  const server = createServer(async (request, response) => {
    const path = normalize(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const file = join(root, path === "/" ? "index.html" : path);
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}/` });
    });
  });
}
