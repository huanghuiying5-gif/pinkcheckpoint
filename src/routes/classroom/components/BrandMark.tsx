import { AudioLines } from "lucide-react";

export function BrandMark() {
  return (
    <div className="brand-mark" aria-label="Speak with Rhythm">
      <span className="brand-mark__line">
        Speak
        <AudioLines className="brand-mark__wave" aria-hidden="true" />
      </span>
      <span className="brand-mark__line">
        <AudioLines className="brand-mark__wave" aria-hidden="true" />
        with <em>Rhythm</em>
      </span>
    </div>
  );
}
