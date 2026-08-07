import { Sparkles } from "lucide-react";

import type { PraiseWord } from "../praise";

const CONFETTI = Array.from({ length: 14 }, (_, index) => index);

export function PraiseReveal({ praiseWord }: { praiseWord: PraiseWord }) {
  return (
    <div className="praise-reveal" aria-live="polite">
      <div className="praise-reveal__sparkles" aria-hidden="true">
        {CONFETTI.map((index) => (
          <i key={index} />
        ))}
        <Sparkles />
        <Sparkles />
      </div>
      <p>{praiseWord}</p>
      <span>Here’s what your voice did beautifully.</span>
    </div>
  );
}
