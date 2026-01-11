import React from "react";
import type { Job } from "../../types/job-queue";

/**
 * Event Bus for Job Queue
 * Replaces polling with event-driven updates for better performance
 */

// Extended event types for more granular control
interface JobQueueEventMap {
  "job:added": { jobId: string; job: Job };
  "job:processing": { jobId: string; job: Job };
  "job:completed": { jobId: string; job: Job; txHash: string };
  "job:failed": { jobId: string; job: Job; error: string };
  "queue:sync-completed": { result: { processed: number; failed: number; skipped: number } };
  "offline:status-changed": { isOnline: boolean };
}

type JobQueueEventType = keyof JobQueueEventMap;
type JobQueueEventData<T extends JobQueueEventType> = JobQueueEventMap[T];

// Type-safe event listener
type JobQueueEventListener<T extends JobQueueEventType> = (data: JobQueueEventData<T>) => void;

class JobQueueEventBus extends EventTarget {
  // Track listeners for explicit cleanup
  private listenerRegistry = new Map<string, Set<{ type: string; listener: EventListener }>>();
  private listenerId = 0;

  /**
   * Emit a typed event
   */
  emit<T extends JobQueueEventType>(type: T, data: JobQueueEventData<T>): void {
    if ((import.meta as any).env?.VITE_QUEUE_DEBUG === "true") {
      // eslint-disable-next-line no-console
      console.debug("[JobQueueEventBus] emit", type, data);
    }
    this.dispatchEvent(new CustomEvent(type, { detail: data }));
  }

  /**
   * Subscribe to a typed event
   */
  on<T extends JobQueueEventType>(type: T, listener: JobQueueEventListener<T>): () => void {
    const eventListener = (event: Event) => {
      const customEvent = event as CustomEvent<JobQueueEventData<T>>;
      listener(customEvent.detail);
    };

    // Track this listener for cleanup
    const id = String(++this.listenerId);
    if (!this.listenerRegistry.has(id)) {
      this.listenerRegistry.set(id, new Set());
    }
    this.listenerRegistry.get(id)!.add({ type, listener: eventListener });

    this.addEventListener(type, eventListener);

    // Return unsubscribe function that also cleans up registry
    return () => {
      this.removeEventListener(type, eventListener);
      const listeners = this.listenerRegistry.get(id);
      if (listeners) {
        listeners.forEach((entry) => {
          if (entry.listener === eventListener) {
            listeners.delete(entry);
          }
        });
        if (listeners.size === 0) {
          this.listenerRegistry.delete(id);
        }
      }
    };
  }

  /**
   * Subscribe to multiple events at once
   */
  onMultiple<T extends JobQueueEventType>(
    types: T[],
    listener: (type: T, data: JobQueueEventData<T>) => void
  ): () => void {
    const unsubscribeFunctions = types.map((type) => this.on(type, (data) => listener(type, data)));

    // Return function to unsubscribe from all
    return () => {
      unsubscribeFunctions.forEach((unsub) => unsub());
    };
  }

  /**
   * Subscribe to an event once
   */
  once<T extends JobQueueEventType>(type: T, listener: JobQueueEventListener<T>): void {
    const eventListener = (event: Event) => {
      const customEvent = event as CustomEvent<JobQueueEventData<T>>;
      listener(customEvent.detail);
      this.removeEventListener(type, eventListener);
    };

    this.addEventListener(type, eventListener);
  }

  /**
   * Remove all listeners (cleanup)
   */
  removeAllListeners(): void {
    // Explicitly remove all tracked listeners
    this.listenerRegistry.forEach((listeners) => {
      listeners.forEach(({ type, listener }) => {
        this.removeEventListener(type, listener);
      });
    });
    this.listenerRegistry.clear();
  }
}

// Export singleton instance
export const jobQueueEventBus = new JobQueueEventBus();

// React hook for using the event bus
export function useJobQueueEvent<T extends JobQueueEventType>(
  type: T,
  listener: JobQueueEventListener<T>,
  deps: React.DependencyList = []
): void {
  React.useEffect(() => {
    const unsubscribe = jobQueueEventBus.on(type, listener);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, listener, ...deps]);
}

// React hook for using multiple events
export function useJobQueueEvents<T extends JobQueueEventType>(
  types: T[],
  listener: (type: T, data: JobQueueEventData<T>) => void,
  deps: React.DependencyList = []
): void {
  // Memoize types array to prevent unnecessary re-subscriptions
  // Using JSON.stringify creates a stable dependency
  const typesKey = JSON.stringify(types);

  React.useEffect(() => {
    const unsubscribe = jobQueueEventBus.onMultiple(types, listener);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesKey, ...deps]);
}

// Cleanup event bus on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    jobQueueEventBus.removeAllListeners();
  });
}
