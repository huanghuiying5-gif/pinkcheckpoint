import { AudioWaveform, Sparkles, Waves } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ReflectionCardData {
  title: string;
  description: string;
  icon: LucideIcon;
}

const REFLECTION_CARDS: ReflectionCardData[] = [
  {
    title: "Rhythm",
    description: "Checking your stress and flow",
    icon: AudioWaveform,
  },
  {
    title: "Fluency",
    description: "Evaluating your smooth delivery",
    icon: Waves,
  },
  {
    title: "Clarity",
    description: "Understanding your message clearly",
    icon: Sparkles,
  },
];

export function ReflectionCards() {
  return (
    <div className="reflection-cards" aria-label="Reflection dimensions">
      {REFLECTION_CARDS.map(({ title, description, icon: Icon }) => (
        <article className="reflection-card" key={title}>
          <span className="reflection-card__icon">
            <Icon aria-hidden="true" />
          </span>
          <h2>{title}</h2>
          <p>{description}</p>
          <span className="reflection-card__loading" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </article>
      ))}
    </div>
  );
}
