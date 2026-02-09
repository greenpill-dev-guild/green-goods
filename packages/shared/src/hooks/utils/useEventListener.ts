/**
 * Event Listener Hook
 *
 * Safely attaches event listeners with automatic cleanup.
 * Prevents memory leaks by properly removing listeners on unmount.
 *
 * @module hooks/utils/useEventListener
 */

import { useEffect, useRef } from "react";

type EventMap<T> = T extends Window
  ? WindowEventMap
  : T extends Document
    ? DocumentEventMap
    : T extends HTMLElement
      ? HTMLElementEventMap
      : T extends ServiceWorkerContainer
        ? ServiceWorkerContainerEventMap
        : T extends ServiceWorkerRegistration
          ? ServiceWorkerRegistrationEventMap
          : T extends ServiceWorker
            ? ServiceWorkerEventMap
            : Record<string, Event>;

export interface UseEventListenerOptions extends AddEventListenerOptions {
  /** If true, the listener will only fire once then be automatically removed */
  once?: boolean;
  /** If true, prevents the event from bubbling */
  capture?: boolean;
  /** If true, indicates that the function specified by listener will never call preventDefault() */
  passive?: boolean;
  /** AbortSignal to manually abort the listener */
  signal?: AbortSignal;
}

/**
 * Attaches an event listener to a target with automatic cleanup.
 *
 * @param target - The target element, window, document, or any EventTarget
 * @param eventName - The event to listen for
 * @param handler - The event handler function
 * @param options - Optional event listener options
 *
 * @example
 * ```tsx
 * // Listen to window resize
 * useEventListener(window, "resize", (e) => {
 *   console.log("Resized", e);
 * });
 *
 * // Listen to document visibility change
 * useEventListener(document, "visibilitychange", () => {
 *   if (document.visibilityState === "visible") {
 *     refetch();
 *   }
 * });
 *
 * // Listen to service worker events
 * useEventListener(navigator.serviceWorker, "controllerchange", () => {
 *   window.location.reload();
 * }, { once: true });
 * ```
 */
export function useEventListener<T extends EventTarget, K extends keyof EventMap<T> & string>(
  target: T | null | undefined,
  eventName: K,
  handler: (event: EventMap<T>[K]) => void,
  options?: UseEventListenerOptions
): void {
  // Store handler in ref to always call the latest version
  const savedHandler = useRef(handler);

  // Extract primitive options to avoid object identity issues in deps
  const capture = options?.capture;
  const once = options?.once;
  const passive = options?.passive;
  const signal = options?.signal;

  // Update ref when handler changes
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Ensure target is valid
    if (!target || !target.addEventListener) {
      return;
    }

    // Create event listener that calls the latest handler
    const eventListener = (event: Event) => {
      savedHandler.current(event as EventMap<T>[K]);
    };

    // Build options from primitives to ensure stable cleanup
    const listenerOptions: AddEventListenerOptions | undefined =
      capture !== undefined || once !== undefined || passive !== undefined || signal !== undefined
        ? { capture, once, passive, signal }
        : undefined;

    // Add listener
    target.addEventListener(eventName, eventListener, listenerOptions);

    // Cleanup on unmount or when dependencies change
    return () => {
      target.removeEventListener(eventName, eventListener, listenerOptions);
    };
  }, [target, eventName, capture, once, passive, signal]);
}

/**
 * Attaches an event listener to window with automatic cleanup.
 * Convenience wrapper for useEventListener(window, ...).
 */
export function useWindowEvent<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: UseEventListenerOptions
): void {
  useEventListener(typeof window !== "undefined" ? window : null, eventName, handler, options);
}

/**
 * Attaches an event listener to document with automatic cleanup.
 * Convenience wrapper for useEventListener(document, ...).
 */
export function useDocumentEvent<K extends keyof DocumentEventMap>(
  eventName: K,
  handler: (event: DocumentEventMap[K]) => void,
  options?: UseEventListenerOptions
): void {
  useEventListener(typeof document !== "undefined" ? document : null, eventName, handler, options);
}
