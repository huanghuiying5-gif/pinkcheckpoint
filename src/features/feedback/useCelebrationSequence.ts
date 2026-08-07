import { useEffect, useState } from "react";

import { playCelebrationSound } from "./celebrationSound";
import { choosePraiseWord } from "./praise";
import type { PraiseWord } from "./praise";

const PRAISE_DELAY_MS = 500;

export function useCelebrationSequence(
  initialPraiseWord: PraiseWord = choosePraiseWord(),
) {
  const [praiseWord] = useState(initialPraiseWord);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const runSequence = async () => {
      await playCelebrationSound(controller.signal);

      if (controller.signal.aborted) {
        return;
      }

      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, PRAISE_DELAY_MS);
        controller.signal.addEventListener(
          "abort",
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });

      if (!controller.signal.aborted) {
        setIsRevealed(true);
      }
    };

    const start = window.setTimeout(() => void runSequence(), 0);

    return () => {
      window.clearTimeout(start);
      controller.abort();
    };
  }, []);

  return { praiseWord, isRevealed };
}
