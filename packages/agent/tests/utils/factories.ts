import type { InboundMessage, User, Session, WorkDraftData } from "../../src/types";
import { faker } from "@faker-js/faker";

// Set seed for reproducible tests
faker.seed(12345);

export function createMockMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: faker.string.uuid(),
    platform: "telegram",
    sender: {
      platformId: faker.string.numeric(10),
      displayName: faker.person.firstName(),
      username: faker.internet.username(),
    },
    content: { type: "text", text: "Default test message" },
    locale: "en",
    timestamp: Date.now(),
    raw: {},
    ...overrides,
  };
}

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: faker.number.int({ min: 1, max: 1000 }),
    platform: "telegram",
    platformId: faker.string.numeric(10),
    privateKey: "0x" + faker.string.hexadecimal({ length: 64, prefix: "" }),
    address: "0x" + faker.string.hexadecimal({ length: 40, prefix: "" }),
    role: "gardener",
    currentGarden: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    platformId: faker.string.numeric(10),
    step: "idle",
    data: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function createMockWorkDraft(overrides: Partial<WorkDraftData> = {}): WorkDraftData {
  return {
    actions: [
      {
        actionUID: "water",
        quantity: faker.number.int({ min: 1, max: 100 }),
      },
      {
        actionUID: "plant",
        quantity: faker.number.int({ min: 1, max: 20 }),
      },
    ],
    gardenAddress: "0x" + faker.string.hexadecimal({ length: 40, prefix: "" }),
    metadata: {
      description: faker.lorem.sentence(),
      mediaHashes: [],
    },
    estimatedReward: faker.number.int({ min: 10, max: 1000 }),
    ...overrides,
  };
}

// Test data builders for complex scenarios
export class MessageBuilder {
  private message: InboundMessage;

  constructor() {
    this.message = createMockMessage();
  }

  withCommand(name: string, args: string[] = []): this {
    this.message.content = { type: "command", name, args };
    return this;
  }

  withText(text: string): this {
    this.message.content = { type: "text", text };
    return this;
  }

  withPhoto(photoId: string, caption?: string): this {
    this.message.content = { type: "photo", photoId, caption };
    return this;
  }

  withCallback(data: string): this {
    this.message.content = { type: "callback", data };
    return this;
  }

  fromUser(platformId: string): this {
    this.message.sender.platformId = platformId;
    return this;
  }

  inLocale(locale: string): this {
    this.message.locale = locale;
    return this;
  }

  build(): InboundMessage {
    return this.message;
  }
}

// Test scenarios
export const testScenarios = {
  newUser: () => ({
    message: new MessageBuilder().withCommand("start").build(),
    expectedResponse: /Welcome to Green Goods/,
  }),

  existingUser: (platformId: string) => ({
    message: new MessageBuilder().withCommand("start").fromUser(platformId).build(),
    expectedResponse: /Welcome back/,
  }),

  joinGarden: (gardenAddress: string) => ({
    message: new MessageBuilder().withCommand("join", [gardenAddress]).build(),
    expectedResponse: /Successfully joined garden/,
  }),

  submitWork: (description: string) => ({
    message: new MessageBuilder().withText(description).build(),
    expectedResponse: /Confirm your work submission/,
  }),

  confirmWork: () => ({
    message: new MessageBuilder().withCallback("confirm_work").build(),
    expectedResponse: /Work submitted successfully/,
  }),

  cancelWork: () => ({
    message: new MessageBuilder().withCallback("cancel_submission").build(),
    expectedResponse: /Submission cancelled/,
  }),
};
