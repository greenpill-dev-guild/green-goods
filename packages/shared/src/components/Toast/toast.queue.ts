export interface ToastDismissQueueOptions {
  dismiss(id: string): void;
  now?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  maxPauseMs?: number;
}

interface DismissTimer {
  remaining: number;
  startedAt: number;
  runTimer: ReturnType<typeof setTimeout> | null;
  capTimer: ReturnType<typeof setTimeout> | null;
  paused: boolean;
}

export interface ToastDismissQueue {
  schedule(id: string, duration: number): void;
  pause(id: string): void;
  resume(id: string): void;
  clear(id?: string): void;
}

export function createToastDismissQueue(options: ToastDismissQueueOptions): ToastDismissQueue {
  const now = options.now ?? Date.now;
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  const maxPauseMs = options.maxPauseMs ?? 8_000;
  const timers = new Map<string, DismissTimer>();

  const clear = (id?: string) => {
    const clearEntry = (entry: DismissTimer) => {
      if (entry.runTimer) clearTimer(entry.runTimer);
      if (entry.capTimer) clearTimer(entry.capTimer);
    };
    if (id === undefined) {
      timers.forEach(clearEntry);
      timers.clear();
      return;
    }
    const entry = timers.get(id);
    if (!entry) return;
    clearEntry(entry);
    timers.delete(id);
  };

  const fire = (id: string) => {
    timers.delete(id);
    options.dismiss(id);
  };

  const resume = (id: string) => {
    const entry = timers.get(id);
    if (!entry || !entry.paused) return;
    if (entry.capTimer) clearTimer(entry.capTimer);
    entry.capTimer = null;
    entry.paused = false;
    entry.startedAt = now();
    entry.runTimer = setTimer(() => fire(id), entry.remaining);
  };

  const schedule = (id: string, duration: number) => {
    clear(id);
    if (!Number.isFinite(duration)) return;
    timers.set(id, {
      remaining: duration,
      startedAt: now(),
      runTimer: setTimer(() => fire(id), duration),
      capTimer: null,
      paused: false,
    });
  };

  const pause = (id: string) => {
    const entry = timers.get(id);
    if (!entry || entry.paused || !entry.runTimer) return;
    clearTimer(entry.runTimer);
    entry.runTimer = null;
    entry.remaining = Math.max(0, entry.remaining - (now() - entry.startedAt));
    entry.paused = true;
    entry.capTimer = setTimer(() => resume(id), maxPauseMs);
  };

  return { schedule, pause, resume, clear };
}
