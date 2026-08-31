import type { Job } from "../../types/job-queue";
import type { TransactionSender } from "../transactions/types";
import type { JobExecution, JobExecutorRegistry } from "./ports";

export type JobExecutor = (
  jobId: string,
  job: Job,
  chainId: number,
  sender: TransactionSender
) => Promise<JobExecution>;

export function createJobExecutorRegistry(
  executors: Readonly<Record<string, JobExecutor>>
): JobExecutorRegistry {
  return {
    execute(jobId, job, chainId, sender) {
      const executor = executors[job.kind];
      if (!executor) throw new Error(`Unsupported job kind: ${job.kind}`);
      return executor(jobId, job, chainId, sender);
    },
  };
}
