import { useCallback, useEffect, useState } from "react";

import type { ReadingSessionState } from "./types";

const COUNTDOWN_SECONDS = 3;

const INITIAL_STATE: ReadingSessionState = {
  phase: "idle",
  countdown: COUNTDOWN_SECONDS,
  elapsedSeconds: 0,
};

/**
 * Coordinates the preparation countdown and recording timer.
 * Browser audio capture remains isolated in the recording feature.
 */
export function useReadingSession() {
  const [state, setState] = useState<ReadingSessionState>(INITIAL_STATE);

  const startCountdown = useCallback(() => {
    setState((current) =>
      current.phase === "idle"
        ? {
            phase: "countdown",
            countdown: COUNTDOWN_SECONDS,
            elapsedSeconds: 0,
          }
        : current,
    );
  }, []);

  const completeRecording = useCallback(() => {
    setState((current) =>
      current.phase === "recording"
        ? {
            ...current,
            phase: "review",
          }
        : current,
    );
  }, []);

  const resetSession = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  useEffect(() => {
    if (state.phase !== "countdown") {
      return;
    }

    const timeout = window.setTimeout(() => {
      setState((current) => {
        if (current.phase !== "countdown") {
          return current;
        }

        if (current.countdown === 1) {
          return {
            phase: "recording",
            countdown: 0,
            elapsedSeconds: 0,
          };
        }

        return {
          ...current,
          countdown: current.countdown - 1,
        };
      });
    }, 1_000);

    return () => window.clearTimeout(timeout);
  }, [state.phase, state.countdown]);

  useEffect(() => {
    if (state.phase !== "recording") {
      return;
    }

    const startedAt = Date.now() - state.elapsedSeconds * 1_000;
    const interval = window.setInterval(() => {
      setState((current) =>
        current.phase === "recording"
          ? {
              ...current,
              elapsedSeconds: Math.floor((Date.now() - startedAt) / 1_000),
            }
          : current,
      );
    }, 250);

    return () => window.clearInterval(interval);
    // The start time is established once when recording begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  return {
    ...state,
    startCountdown,
    completeRecording,
    resetSession,
  };
}
