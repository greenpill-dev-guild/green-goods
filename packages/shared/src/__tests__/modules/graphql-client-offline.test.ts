/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  trackGraphQLError: vi.fn(),
  connectivityState: "online" as "online" | "offline",
}));

vi.mock("graphql-request", () => ({
  GraphQLClient: class {
    request = mocks.request;
  },
}));

vi.mock("../../modules/app/error-tracking", () => ({
  trackGraphQLError: mocks.trackGraphQLError,
}));

vi.mock("../../stores/connectivity", () => ({
  connectivityStore: {
    getStatusSnapshot: () => ({ state: mocks.connectivityState }),
  },
}));

import { GQLClient } from "../../modules/data/graphql-client";

describe("GraphQL error telemetry connectivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectivityState = "online";
    mocks.request.mockRejectedValue(new Error("network unavailable"));
  });

  it("reports a query failure while connectivity is usable", async () => {
    const result = await new GQLClient("https://example.test/graphql").query(
      "query Test { value }",
      {},
      "Test"
    );

    expect(result).toMatchObject({ error: { message: "network unavailable" } });
    expect(mocks.trackGraphQLError).toHaveBeenCalledTimes(1);
  });

  it("does not report an expected query failure after confirmed offline", async () => {
    mocks.connectivityState = "offline";

    const result = await new GQLClient("https://example.test/graphql").query(
      "query Test { value }",
      {},
      "Test"
    );

    expect(result).toMatchObject({ error: { message: "network unavailable" } });
    expect(mocks.trackGraphQLError).not.toHaveBeenCalled();
  });
});
