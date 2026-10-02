// TEST-QUALITY: allow-small-test-file - the first request must start while this file loads, before the core setup replaces fetch, so it cannot join another file
import { describe, expect, it } from "vitest";

// While the file loads, fetch is still happy-dom's own, which would reach the network.
const beforeSetup = globalThis
  .fetch("https://pulse.walletconnect.org/batch?projectId=test")
  .then((response) => response.status);

describe("DOM tests stay off the network", () => {
  it("answers a request made while the file loads instead of sending it", async () => {
    await expect(beforeSetup).resolves.toBe(503);
  });

  it("refuses a request a test makes without mocking it", () => {
    expect(() => window.fetch("https://example.test/data")).toThrow(
      "Unexpected fetch call to: https://example.test/data"
    );
  });
});
