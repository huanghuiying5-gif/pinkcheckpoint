import { Heart, Sparkles } from "lucide-react";

export function ReflectionHeading() {
  return (
    <header className="reflection-heading">
      <div className="reflection-heading__symbol" aria-hidden="true">
        <Sparkles />
        <Heart />
        <Sparkles />
      </div>
      <h1 id="reflection-title">AI is listening...</h1>
      <p>Reflecting on your voice</p>
    </header>
  );
}
