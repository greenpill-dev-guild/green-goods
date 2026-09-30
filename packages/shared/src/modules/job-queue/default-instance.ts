import { createDefaultJobQueueDependencies } from "./default-dependencies";
import { createJobQueue } from "./queue";

/** Stable application singleton composed from the browser adapters. */
export const jobQueue = createJobQueue(createDefaultJobQueueDependencies());
