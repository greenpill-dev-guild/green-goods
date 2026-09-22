import { beforeEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("../../modules/app/posthog", () => ({ track }));

import { trackGardenJoinRequestFailed } from "../../modules/garden-join-requests/analytics";

describe("join-request failure telemetry", () => {
  beforeEach(() => track.mockClear());

  it.each([
    ["an error class name", "ConnectorNotConnectedError", "ConnectorNotConnectedError"],
    ["the base error class", "Error", "Error"],
    ["a DOM exception", "DOMException", "DOMException"],
    // `name` is writable, so a name that is not shaped like a class name is not kept.
    ["a letters-only name that is not a class name", "secrettoken", "unknown"],
    [
      "a name that carries an address",
      "Error 0x1111111111111111111111111111111111111111",
      "unknown",
    ],
    ["a name that carries a URL", "https://rpc.example/v2/secret-key", "unknown"],
  ])("records %s as a bounded value, anonymously", (_label, errorName, recorded) => {
    trackGardenJoinRequestFailed({ operation: "create", errorName });

    expect(track).toHaveBeenCalledWith(
      "garden_join_request_failed",
      expect.objectContaining({ operation: "create", error_name: recorded }),
      { anonymizeIdentity: true, includeSessionId: false }
    );
  });
});
