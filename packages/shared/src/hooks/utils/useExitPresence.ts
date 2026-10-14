import { useEffect, useRef, useState } from "react";
import { useTimeout } from "./useTimeout";

/**
 * Keeps a conditionally mounted surface in the tree until its exit has played.
 *
 * A sheet rendered as `{open ? <Sheet open /> : null}` leaves the tree the
 * moment it closes, so it never receives `open={false}` and its exit animation
 * never runs. Render the surface while this hook returns true and pass the real
 * `open` flag down instead: it stays for `exitMs` after closing and then leaves,
 * so a lazy chunk still loads on first use and the surface's own state still
 * resets between openings.
 *
 * `exitMs` may be a function when the duration comes from a CSS token; it is
 * read once, when the close starts.
 */
export function useExitPresence(open: boolean, exitMs: number | (() => number)): boolean {
  const [present, setPresent] = useState(open);
  const { set, clear } = useTimeout();
  const exitMsRef = useRef(exitMs);

  useEffect(() => {
    exitMsRef.current = exitMs;
  }, [exitMs]);

  // Opening shows the surface in the same render, without an effect round trip.
  if (open && !present) setPresent(true);

  useEffect(() => {
    if (open || !present) return;
    const exit = exitMsRef.current;
    set(() => setPresent(false), typeof exit === "function" ? exit() : exit);
    return clear;
  }, [open, present, set, clear]);

  return open || present;
}
