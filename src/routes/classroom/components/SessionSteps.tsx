import { AudioWaveform, Mic, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SessionStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

const STEPS: SessionStep[] = [
  {
    title: "1. Read Aloud",
    description: "Speak clearly and naturally.",
    icon: Mic,
  },
  {
    title: "2. AI Listening",
    description: "We’ll reflect on your speech.",
    icon: AudioWaveform,
  },
  {
    title: "3. Get Feedback",
    description: "See how you did and improve!",
    icon: Sparkles,
  },
];

export function SessionSteps() {
  return (
    <ol className="session-steps" aria-label="Reading session steps">
      {STEPS.map(({ title, description, icon: Icon }) => (
        <li className="session-step" key={title}>
          <span className="session-step__icon">
            <Icon aria-hidden="true" />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
