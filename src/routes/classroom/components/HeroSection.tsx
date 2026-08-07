import { Heart } from "lucide-react";

export function HeroSection() {
  return (
    <section className="hero-section" aria-labelledby="hero-heading">
      <h1 id="hero-heading" className="hero-heading">
        <span>Find your rhythm</span>
        <em>let your voice</em>
        <span className="hero-heading__italic">be heard</span>
      </h1>
      <div className="hero-kicker">
        <span className="hero-kicker__line" aria-hidden="true" />
        <Heart aria-hidden="true" />
        <span>Let your voice tell your story.</span>
        <span className="hero-kicker__line" aria-hidden="true" />
      </div>
    </section>
  );
}
