/** @vitest-environment happy-dom */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  trackGraphQLError: vi.fn(),
  steady: true,
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
    failedOnSteadyConnection: () => Promise.resolve(mocks.steady),
  },
}));

import { GQLClient } from "../../modules/data/graphql-client";

describe("GraphQL error telemetry connectivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.steady = true;
    mocks.request.mockRejectedValue(new Error("network unavailable"));
  });

  it("reports a query failure on a steady connection", async () => {
    const result = await new GQLClient("https://example.test/graphql").query(
      "query Test { value }",
      {},
      "Test"
    );

    expect(result).toMatchObject({ error: { message: "network unavailable" } });
    await vi.waitFor(() => expect(mocks.trackGraphQLError).toHaveBeenCalledTimes(1));
  });

  it("does not report a query failure that a network change caused", async () => {
    mocks.steady = false;

    const result = await new GQLClient("https://example.test/graphql").query(
      "query Test { value }",
      {},
      "Test"
    );

    expect(result).toMatchObject({ error: { message: "network unavailable" } });
    await Promise.resolve();
    expect(mocks.trackGraphQLError).not.toHaveBeenCalled();
  });
});
