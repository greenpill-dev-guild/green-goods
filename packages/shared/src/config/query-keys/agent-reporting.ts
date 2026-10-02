/** Ceremony reads are private and short-lived; callers keep them out of any persisted cache. */
export const agentReportingKeys = {
  grant: (grantId: string) => ["greengoods", "agent-reporting", "grant", grantId] as const,
  all: ["greengoods", "agent-reporting"] as const,
  challenge: (challengeId: string) =>
    ["greengoods", "agent-reporting", "challenge", challengeId] as const,
  operation: (operationId: string) =>
    ["greengoods", "agent-reporting", "operation", operationId] as const,
} as const;
