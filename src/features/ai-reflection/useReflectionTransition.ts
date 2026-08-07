import { useEffect } from "react";

export const REFLECTION_DURATION_MS = 3_000;

export function useReflectionTransition(onComplete: () => void) {
  useEffect(() => {
    const timeout = window.setTimeout(onComplete, REFLECTION_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);
}
