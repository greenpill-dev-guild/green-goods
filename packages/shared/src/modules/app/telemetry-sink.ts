/**
 * The telemetry transport: who events are handed to.
 *
 * `posthog` decides what is tracked and adds its context; `posthog-browser` connects the real
 * transport once the app is interactive. This module only holds whichever is connected. Until one
 * is, a stand-in takes events and drops them, which is why a crash is kept on the device instead
 * (`crash-reports`).
 *
 * @module modules/app/telemetry-sink
 */

import { logger } from "./logger";

const IS_DEV = import.meta.env.DEV;
const IS_DEBUG = import.meta.env.VITE_POSTHOG_DEBUG === "true";

/** When an event happened and which one it is, for an event delivered after the fact. */
export interface RecordedEventTiming {
  timestamp: Date;
  /** A UUID. The same event delivered twice, by two tabs, then counts once. */
  uuid?: string;
}

export interface TelemetrySink {
  capture(event: string, properties: Record<string, unknown>, timing?: RecordedEventTiming): void;
  /** Files an error where the transport groups errors (PostHog Error Tracking). */
  captureException?(error: Error, properties: Record<string, unknown>): void;
  identify?(distinctId: string, properties?: Record<string, unknown>): void;
  reset?(): void;
  getDistinctId?(): string;
  register?(properties: Record<string, unknown>): void;
  isReady?(): boolean;
}

const noOpTelemetrySink: TelemetrySink = {
  capture() {
    if (IS_DEBUG && !IS_DEV) logger.warn("[PostHog] Not ready, skipping capture");
  },
  isReady: () => false,
};

let telemetrySink: TelemetrySink = noOpTelemetrySink;

/** Replace the event transport while preserving tracking policy and enrichment. */
export function registerTelemetrySink(sink: TelemetrySink): () => void {
  const previous = telemetrySink;
  telemetrySink = sink;
  return () => {
    if (telemetrySink === sink) telemetrySink = previous;
  };
}

/** The connected transport, or the stand-in that drops events until one connects. */
export function getTelemetrySink(): TelemetrySink {
  return telemetrySink;
}

/** True once a real transport is connected, so an event handed over now is not dropped. */
export function isTelemetryReady(): boolean {
  return telemetrySink.isReady?.() ?? false;
}
