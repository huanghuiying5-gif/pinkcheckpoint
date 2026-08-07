const WAVEFORM_HEIGHTS = [
  10, 14, 18, 25, 31, 40, 50, 62, 48, 37, 54, 70, 82, 65, 51, 77, 94,
  72, 56, 68, 86, 100, 78, 64, 52, 73, 89, 69, 55, 43, 58, 76, 64, 48,
  36, 29, 22, 17, 13, 10,
];

export function ListeningOrb() {
  return (
    <div className="listening-orb" aria-label="Listening waveform animation">
      <span className="listening-orb__ring listening-orb__ring--outer" />
      <span className="listening-orb__ring listening-orb__ring--middle" />
      <span className="listening-orb__ring listening-orb__ring--inner" />
      <div className="listening-orb__waveform" aria-hidden="true">
        {WAVEFORM_HEIGHTS.map((height, index) => (
          <span
            key={`${height}-${index}`}
            style={{
              height: `${height}%`,
              animationDelay: `${(index % 9) * -90}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
