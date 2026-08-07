const KEYWORDS = [
  "Rhythm",
  "Stress",
  "Linking",
  "Flow",
  "Meaning",
  "Communication",
];
const SEQUENCE_REPETITIONS = 8;

function KeywordSequence({ repeatIndex }: { repeatIndex: number }) {
  return (
    <span className="keyword-banner__sequence">
      {KEYWORDS.map((keyword) => (
        <span
          className="keyword-banner__word"
          key={`${repeatIndex}-${keyword}`}
        >
          {keyword}
          <span className="keyword-banner__spark" aria-hidden="true">
            ✦
          </span>
        </span>
      ))}
    </span>
  );
}

function KeywordSet() {
  return (
    <span className="keyword-banner__set" aria-hidden="true">
      {Array.from({ length: SEQUENCE_REPETITIONS }, (_, repeatIndex) => (
        <KeywordSequence repeatIndex={repeatIndex} key={repeatIndex} />
      ))}
    </span>
  );
}

export function KeywordBanner() {
  return (
    <div className="keyword-banner" aria-label={KEYWORDS.join(", ")}>
      <div className="keyword-banner__track">
        <KeywordSet />
        <KeywordSet />
      </div>
    </div>
  );
}
