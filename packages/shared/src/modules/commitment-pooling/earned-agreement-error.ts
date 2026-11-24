/** A reward dependency prevented a new send; its queue job can wait without spending a retry. */
export class EarnedRewardWaiting extends Error {
  constructor(
    readonly reason: "reward-agreement-required" | "reward-paused" | "reward-unreadable",
    cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : reason, { cause });
    this.name = "EarnedRewardWaiting";
  }
}
