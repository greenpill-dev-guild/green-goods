import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";

export const TEST_BOT_TOKEN = "4242:test-token";
export const TEST_BOT_REALM = "telegram:4242";

type Payload = Record<string, unknown>;

export type ApiReply =
  | { ok: true; result: unknown }
  | {
      ok: false;
      error_code: number;
      description: string;
      parameters?: { retry_after?: number };
    };

interface ServedFile {
  status?: number;
  headers?: Record<string, string>;
  body?: Uint8Array;
}

/**
 * A fake Telegram Bot API on a loopback port for the real Telegraf client: it records every method
 * call, answers from a queue of scripted replies (a delivered message by default) and serves files
 * under `/file/bot<token>/`.
 */
export class FakeTelegramApi {
  readonly calls: Array<{ method: string; payload: Payload }> = [];
  readonly files = new Map<string, ServedFile>();
  url = "";
  private readonly replies: ApiReply[] = [];
  private nextMessageId = 100;
  private server: Server | null = null;

  async start(): Promise<this> {
    const server = createServer((request, response) => void this.handle(request, response));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    this.server = server;
    this.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return this;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  /** Scripts the answer to the next API call. */
  reply(reply: ApiReply): void {
    this.replies.push(reply);
  }

  /** The payloads of every sendMessage call so far. */
  messages(): Payload[] {
    return this.calls.filter((call) => call.method === "sendMessage").map((call) => call.payload);
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = new URL(request.url ?? "/", this.url).pathname;
    const filePrefix = `/file/bot${TEST_BOT_TOKEN}/`;
    if (path.startsWith(filePrefix)) {
      const file = this.files.get(path.slice(filePrefix.length));
      response.writeHead(file ? (file.status ?? 200) : 404, file?.headers ?? {});
      response.end(file?.body ? Buffer.from(file.body) : undefined);
      return;
    }
    const method = path.slice(`/bot${TEST_BOT_TOKEN}/`.length);
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks);
    // Under Bun, Telegraf's requests arrive gzip-encoded.
    const gzipped = request.headers["content-encoding"] === "gzip";
    const body = (gzipped ? gunzipSync(raw) : raw).toString("utf8");
    const payload = (body ? JSON.parse(body) : {}) as Payload;
    this.calls.push({ method, payload });
    const reply = this.replies.shift() ?? this.defaultReply(method, payload);
    response.writeHead(reply.ok ? 200 : reply.error_code, { "content-type": "application/json" });
    response.end(JSON.stringify(reply));
  }

  private defaultReply(method: string, payload: Payload): ApiReply {
    if (method === "sendMessage") {
      const message_id = this.nextMessageId++;
      const chat = { id: Number(payload.chat_id), type: "private" };
      return { ok: true, result: { message_id, date: 0, chat, text: payload.text } };
    }
    if (method === "getFile") {
      const fileId = String(payload.file_id);
      return {
        ok: true,
        result: { file_id: fileId, file_unique_id: fileId, file_path: `files/${fileId}` },
      };
    }
    return { ok: true, result: true };
  }
}
