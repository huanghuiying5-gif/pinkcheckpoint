import { useEffect } from "react";

export const REFLECTION_DURATION_MS = 3_000;

export interface ReflectionDeadlineTimer {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timeout: number): void;
}

const browserTimer: ReflectionDeadlineTimer = {
  now: () => performance.now(),
  setTimeout: (callback, delayMs) =>
    globalThis.setTimeout(callback, delayMs) as unknown as number,
  clearTimeout: (timeout) => globalThis.clearTimeout(timeout),
};

/** Schedules one completion no earlier than the fixed classroom deadline. */
export function scheduleReflectionDeadline(
  onComplete: () => void,
  timer: ReflectionDeadlineTimer = browserTimer,
): () => void {
  const startedAt = timer.now();
  let timeout: number | undefined;
  let completed = false;

  const completeAtDeadline = () => {
    if (completed) return;
    const remaining = REFLECTION_DURATION_MS - (timer.now() - startedAt);
    if (remaining > 0) {
      timeout = timer.setTimeout(completeAtDeadline, remaining);
      return;
    }
    completed = true;
    onComplete();
  };

  timeout = timer.setTimeout(completeAtDeadline, REFLECTION_DURATION_MS);
  return () => {
    completed = true;
    if (timeout !== undefined) timer.clearTimeout(timeout);
  };
}

export function useReflectionTransition(onComplete: () => void) {
  useEffect(() => {
    return scheduleReflectionDeadline(onComplete);
  }, [onComplete]);
}
