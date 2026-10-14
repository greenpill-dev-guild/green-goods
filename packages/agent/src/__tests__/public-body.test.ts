import { describe, expect, it } from "vitest";

import { readLimitedJsonBody } from "../api/http/body";

describe("public request body limits", () => {
  it("stops an oversized chunked body before buffering the full request", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(1024));
        if (pulls === 20) controller.close();
      },
    });
    const request = new Request("https://agent.example/public/saved-offers", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const result = await readLimitedJsonBody(request, 2 * 1024);
    expect(result).toMatchObject({ ok: false, status: 413 });
    expect(pulls).toBeLessThan(20);
  });
});
