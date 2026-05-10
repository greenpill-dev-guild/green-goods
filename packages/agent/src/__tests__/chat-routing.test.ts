/**
 * Routing rules for the platform adapter — chat-type guard + private-only
 * command list. Critical safety invariants live here:
 *  - commands/callbacks never run in groups (would leak wallet/work info)
 *  - video/document in private DM is ignored (regression guard)
 *  - non-command content in groups always goes to the silent capture path
 *  - channel posts are dropped entirely
 */

import { describe, expect, it, vi } from "vitest";
import { chooseHandler } from "../platforms/telegram";
import type { InboundMessage, MessageContent } from "../types";

const messageHandler = vi.fn();
const groupCaptureHandler = vi.fn();

function build(
  chatType: InboundMessage["chat"]["type"],
  content: MessageContent,
  threadId?: string
): InboundMessage {
  return {
    id: "msg-1",
    platform: "telegram",
    chat: { id: "-1002847752257", type: chatType, threadId },
    sender: { platformId: "user-1" },
    content,
    timestamp: Date.now(),
  };
}

describe("chooseHandler — private DM", () => {
  it("routes text to handleMessage", () => {
    const handler = chooseHandler(
      build("private", { type: "text", text: "hi" }),
      messageHandler,
      groupCaptureHandler
    );
    expect(handler).toBe(messageHandler);
  });

  it("routes commands to handleMessage (including /start)", () => {
    const handler = chooseHandler(
      build("private", { type: "command", name: "start", args: [] }),
      messageHandler,
      groupCaptureHandler
    );
    expect(handler).toBe(messageHandler);
  });

  it("routes voice and image to handleMessage (work-submission flow)", () => {
    expect(
      chooseHandler(
        build("private", { type: "voice", audioUrl: "f", mimeType: "audio/ogg" }),
        messageHandler,
        groupCaptureHandler
      )
    ).toBe(messageHandler);
    expect(
      chooseHandler(
        build("private", { type: "image", imageUrl: "f", mimeType: "image/jpeg" }),
        messageHandler,
        groupCaptureHandler
      )
    ).toBe(messageHandler);
  });

  it("ignores video and document in private DM (no fall-through to handleMessage)", () => {
    expect(
      chooseHandler(
        build("private", { type: "video", videoUrl: "f", mimeType: "video/mp4" }),
        messageHandler,
        groupCaptureHandler
      )
    ).toBeNull();
    expect(
      chooseHandler(
        build("private", {
          type: "document",
          documentUrl: "f",
          mimeType: "application/pdf",
        }),
        messageHandler,
        groupCaptureHandler
      )
    ).toBeNull();
  });
});

describe("chooseHandler — group / supergroup", () => {
  it("routes non-command content to handleGroupCapture", () => {
    expect(
      chooseHandler(
        build("supergroup", { type: "text", text: "the map keeps freezing" }, "311"),
        messageHandler,
        groupCaptureHandler
      )
    ).toBe(groupCaptureHandler);
    expect(
      chooseHandler(
        build("group", { type: "image", imageUrl: "f", mimeType: "image/jpeg" }, "311"),
        messageHandler,
        groupCaptureHandler
      )
    ).toBe(groupCaptureHandler);
    expect(
      chooseHandler(
        build("supergroup", { type: "video", videoUrl: "f", mimeType: "video/mp4" }, "311"),
        messageHandler,
        groupCaptureHandler
      )
    ).toBe(groupCaptureHandler);
    expect(
      chooseHandler(
        build("supergroup", { type: "voice", audioUrl: "f", mimeType: "audio/ogg" }, "311"),
        messageHandler,
        groupCaptureHandler
      )
    ).toBe(groupCaptureHandler);
  });

  it("drops all commands in groups", () => {
    for (const name of ["help", "pending", "approve", "reject", "start", "join", "status"]) {
      expect(
        chooseHandler(
          build("supergroup", { type: "command", name, args: [] }, "311"),
          messageHandler,
          groupCaptureHandler
        )
      ).toBeNull();
    }
  });

  it("drops uppercase commands in groups too", () => {
    for (const name of ["START", "Status"]) {
      const handler = chooseHandler(
        build("supergroup", { type: "command", name, args: [] }, "311"),
        messageHandler,
        groupCaptureHandler
      );
      expect(handler).toBeNull();
    }
  });

  it("drops callbacks in groups", () => {
    const handler = chooseHandler(
      build("supergroup", { type: "callback", data: "confirm_submission" }, "311"),
      messageHandler,
      groupCaptureHandler
    );
    expect(handler).toBeNull();
  });
});

describe("chooseHandler — channel", () => {
  it("ignores everything in channels", () => {
    expect(
      chooseHandler(
        build("channel", { type: "text", text: "hi" }),
        messageHandler,
        groupCaptureHandler
      )
    ).toBeNull();
    expect(
      chooseHandler(
        build("channel", { type: "command", name: "help", args: [] }),
        messageHandler,
        groupCaptureHandler
      )
    ).toBeNull();
  });
});
