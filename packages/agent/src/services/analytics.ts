import { createHash } from "node:crypto";
import { PostHog } from "posthog-node";
import { createLogger } from "./logger";
import type { InboundMessage, OutboundResponse, Platform } from "../types";

const log = createLogger("analytics");
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";
const RUNTIME_DISTINCT_ID = "green-goods-agent-runtime";

export type AgentAnalyticsEvent =
  | "agent_runtime_started"
  | "agent_message_received"
  | "agent_message_handled"
  | "agent_message_failed"
  | "join_request_created"
  | "join_request_create_rejected"
  | "join_request_status_checked"
  | "join_request_resolved"
  | "join_request_withdrawn"
  | "join_request_expired";

type AgentAnalyticsProperties = Record<string, boolean | number | string | null | undefined>;

type GardenJoinRequestAnalyticsProperties = {
  count?: number;
  error_class?:
    | "already_member"
    | "authentication_failed"
    | "invalid_request"
    | "open_joining"
    | "proof_replayed"
    | "queue_full"
    | "rate_limited"
    | "service_unavailable";
  is_counterfactual?: boolean;
  kind?: "garden_membership";
  requested_via?: "garden_detail";
  resolution?: "declined" | "welcomed";
  retry?: boolean;
  state?: "declined" | "none" | "pending" | "welcomed";
};

interface AgentAnalyticsClient {
  capture: (input: {
    distinctId: string;
    event: string;
    properties?: AgentAnalyticsProperties;
  }) => void | Promise<void>;
  shutdown: () => void | Promise<void>;
}

export interface InitAgentAnalyticsOptions {
  apiKey?: string;
  enabled: boolean;
}

let client: AgentAnalyticsClient | null = null;

export function initAgentAnalytics({ apiKey, enabled }: InitAgentAnalyticsOptions): void {
  const trimmedKey = apiKey?.trim();
  if (!enabled || !trimmedKey) {
    client = null;
    return;
  }

  client = new PostHog(trimmedKey, {
    host: DEFAULT_POSTHOG_HOST,
  }) as AgentAnalyticsClient;
}

export function resetAgentAnalyticsForTests(): void {
  client = null;
}

export function hashAgentDistinctId(platform: Platform, platformId: string): string {
  const digest = createHash("sha256").update(`${platform}:${platformId}`).digest("hex");
  return `agent_user_${digest}`;
}

export function getMessageAnalyticsProperties(message: InboundMessage): AgentAnalyticsProperties {
  return {
    platform: message.platform,
    chat_type: message.chat.type,
    content_type: message.content.type,
    command_name:
      message.content.type === "command" ? message.content.name.toLowerCase() : undefined,
    has_thread: Boolean(message.chat.threadId),
    locale: message.locale,
  };
}

export async function trackAgentEvent(
  event: AgentAnalyticsEvent,
  distinctId: string,
  properties: AgentAnalyticsProperties = {}
): Promise<void> {
  if (!client) return;

  try {
    await Promise.resolve(
      client.capture({
        distinctId,
        event,
        properties,
      })
    );
  } catch (error) {
    log.warn({ err: error, event }, "PostHog capture failed");
  }
}

export async function trackAgentRuntimeStarted(input: {
  mode: string;
  chainId: number;
  nodeEnv: string;
}): Promise<void> {
  await trackAgentEvent("agent_runtime_started", RUNTIME_DISTINCT_ID, {
    mode: input.mode,
    chain_id: input.chainId,
    node_env: input.nodeEnv,
  });
}

export function trackGardenJoinRequestEvent(
  event: Extract<AgentAnalyticsEvent, `join_request_${string}`>,
  properties: GardenJoinRequestAnalyticsProperties
): Promise<void> {
  return trackAgentEvent(event, RUNTIME_DISTINCT_ID, properties);
}

export async function trackAgentMessageReceived(message: InboundMessage): Promise<void> {
  await trackAgentEvent(
    "agent_message_received",
    hashAgentDistinctId(message.platform, message.sender.platformId),
    getMessageAnalyticsProperties(message)
  );
}

export async function trackAgentMessageHandled(
  message: InboundMessage,
  input: { durationMs: number; responseHasButtons: boolean }
): Promise<void> {
  await trackAgentEvent(
    "agent_message_handled",
    hashAgentDistinctId(message.platform, message.sender.platformId),
    {
      ...getMessageAnalyticsProperties(message),
      duration_ms: input.durationMs,
      response_has_buttons: input.responseHasButtons,
    }
  );
}

export async function trackAgentMessageFailed(
  message: InboundMessage,
  error: unknown,
  input: { durationMs: number }
): Promise<void> {
  await trackAgentEvent(
    "agent_message_failed",
    hashAgentDistinctId(message.platform, message.sender.platformId),
    {
      ...getMessageAnalyticsProperties(message),
      duration_ms: input.durationMs,
      error_name: getSafeErrorName(error),
    }
  );
}

export async function shutdownAgentAnalytics(): Promise<void> {
  if (!client) return;

  try {
    await Promise.resolve(client.shutdown());
  } catch (error) {
    log.warn({ err: error }, "PostHog shutdown failed");
  } finally {
    client = null;
  }
}

function getSafeErrorName(error: unknown): string {
  if (error instanceof Error) return error.name || "Error";
  return typeof error;
}

export function responseHasButtons(response: OutboundResponse): boolean {
  return Boolean(response.buttons?.length);
}
