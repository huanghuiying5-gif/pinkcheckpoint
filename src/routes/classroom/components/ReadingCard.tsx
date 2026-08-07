interface ReadingCardProps {
  passage: string;
}

export function ReadingCard({ passage }: ReadingCardProps) {
  return (
    <article className="reading-card">
      <span className="reading-card__quote" aria-hidden="true">
        “
      </span>
      <header className="reading-card__header">
        <p className="reading-card__eyebrow">Today’s Reading</p>
        <span className="reading-card__rule" aria-hidden="true" />
        <h2 id="reading-title" className="reading-card__title">
          Read with rhythm.
        </h2>
      </header>
      <p className="reading-card__passage">{passage}</p>
    </article>
  );
}
