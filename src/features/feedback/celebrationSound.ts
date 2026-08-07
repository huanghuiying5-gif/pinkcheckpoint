const CELEBRATION_DURATION_MS = 920;
let preparedAudioContext: AudioContext | null = null;

function getAudioContextConstructor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

/** Unlocks audio during the Analyze click so the later timed result can chime. */
export function prepareCelebrationAudio(): void {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return;
  }

  if (!preparedAudioContext || preparedAudioContext.state === "closed") {
    preparedAudioContext = new AudioContextConstructor();
  }

  void preparedAudioContext.resume();
}

function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(resolve, milliseconds);

    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

/** Plays a fixed, locally synthesized three-note celebration chime. */
export async function playCelebrationSound(signal?: AbortSignal): Promise<void> {
  const AudioContextConstructor = getAudioContextConstructor();

  if (!AudioContextConstructor) {
    await wait(CELEBRATION_DURATION_MS, signal);
    return;
  }

  const context = preparedAudioContext ?? new AudioContextConstructor();
  const abortPlayback = () => void context.close();
  signal?.addEventListener("abort", abortPlayback, { once: true });

  try {
    await context.resume();

    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.52, context.currentTime + 0.025);
    master.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + CELEBRATION_DURATION_MS / 1_000,
    );
    compressor.threshold.setValueAtTime(-20, context.currentTime);
    compressor.knee.setValueAtTime(20, context.currentTime);
    compressor.ratio.setValueAtTime(5, context.currentTime);
    compressor.attack.setValueAtTime(0.003, context.currentTime);
    compressor.release.setValueAtTime(0.25, context.currentTime);
    master.connect(compressor);
    compressor.connect(context.destination);

    const notes = [
      { frequency: 523.25, start: 0, duration: 0.42 },
      { frequency: 659.25, start: 0.16, duration: 0.46 },
      { frequency: 783.99, start: 0.34, duration: 0.58 },
    ];

    const finished = new Promise<void>((resolve) => {
      notes.forEach((note, index) => {
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const startsAt = context.currentTime + note.start;
        const endsAt = startsAt + note.duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(note.frequency, startsAt);
        envelope.gain.setValueAtTime(0.0001, startsAt);
        envelope.gain.exponentialRampToValueAtTime(0.78, startsAt + 0.025);
        envelope.gain.exponentialRampToValueAtTime(0.0001, endsAt);
        oscillator.connect(envelope);
        envelope.connect(master);
        oscillator.start(startsAt);
        oscillator.stop(endsAt);

        if (index === notes.length - 1) {
          oscillator.onended = () => resolve();
        }
      });
    });

    await finished;
  } catch {
    await wait(CELEBRATION_DURATION_MS, signal);
  } finally {
    signal?.removeEventListener("abort", abortPlayback);
    if (context.state !== "closed") {
      await context.close();
    }
    if (preparedAudioContext === context) {
      preparedAudioContext = null;
    }
  }
}
