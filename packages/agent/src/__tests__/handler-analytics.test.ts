import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMessage } from "../handlers";
import type { InboundMessage } from "../types";

const dbMock = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

const analyticsMock = vi.hoisted(() => ({
  responseHasButtons: vi.fn((response: { buttons?: unknown[] }) =>
    Boolean(response.buttons?.length)
  ),
  trackAgentMessageReceived: vi.fn(),
  trackAgentMessageHandled: vi.fn(),
  trackAgentMessageFailed: vi.fn(),
}));

vi.mock("../services/db", () => dbMock);
vi.mock("../services/analytics", () => analyticsMock);

function createMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: "msg-123",
    platform: "telegram",
    chat: { id: "private-chat", type: "private" },
    sender: { platformId: "user-123", displayName: "Test User" },
    content: { type: "command", name: "help", args: [] },
    locale: "en",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("handleMessage analytics", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("tracks received and handled events around successful dispatch", async () => {
    dbMock.getUser.mockResolvedValueOnce(undefined);
    const message = createMessage();

    const response = await handleMessage(message);

    expect(response.text).toContain("Green Goods Bot Help");
    expect(analyticsMock.trackAgentMessageReceived).toHaveBeenCalledWith(message);
    expect(analyticsMock.trackAgentMessageHandled).toHaveBeenCalledWith(
      message,
      expect.objectContaining({
        responseHasButtons: expect.any(Boolean),
        durationMs: expect.any(Number),
      })
    );
    expect(analyticsMock.trackAgentMessageFailed).not.toHaveBeenCalled();
  });

  it("tracks failed events when dispatch throws", async () => {
    const error = new Error("database unavailable");
    dbMock.getUser.mockRejectedValueOnce(error);
    const message = createMessage();

    await expect(handleMessage(message)).rejects.toThrow(error);

    expect(analyticsMock.trackAgentMessageReceived).toHaveBeenCalledWith(message);
    expect(analyticsMock.trackAgentMessageFailed).toHaveBeenCalledWith(
      message,
      error,
      expect.objectContaining({ durationMs: expect.any(Number) })
    );
    expect(analyticsMock.trackAgentMessageHandled).not.toHaveBeenCalled();
  });
});
