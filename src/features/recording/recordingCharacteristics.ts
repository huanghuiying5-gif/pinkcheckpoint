export interface RecordingCharacteristics {
  attemptId: string;
  volumeStability: number;
  volumeVariation: number;
  recordingQuality: number;
  voicePresence: number;
  durationSeconds: number;
  signature: number;
}

let attemptSequence = 0;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedValues.length - 1,
    Math.floor((sortedValues.length - 1) * percentileValue),
  );
  return sortedValues[index];
}

function createFallbackCharacteristics(
  blob: Blob,
  durationSeconds: number,
): RecordingCharacteristics {
  const bytesPerSecond = blob.size / Math.max(durationSeconds, 1);
  const seed = (blob.size * 31 + Math.round(durationSeconds * 1_000)) >>> 0;

  return {
    attemptId: `attempt-${++attemptSequence}-${seed}`,
    volumeStability: 0.58 + ((seed % 23) / 100),
    volumeVariation: 0.38 + ((seed % 19) / 100),
    recordingQuality: clamp(0.55 + bytesPerSecond / 180_000),
    voicePresence: clamp(bytesPerSecond / 32_000),
    durationSeconds,
    signature: seed,
  };
}

function fingerprintAudio(channelData: Float32Array): number {
  let hash = 2_166_136_261;
  const step = Math.max(1, Math.floor(channelData.length / 4_096));

  for (let index = 0; index < channelData.length; index += step) {
    const sample = Math.round((channelData[index] + 1) * 32_767);
    hash ^= sample;
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

async function decodeCharacteristics(
  blob: Blob,
  fallbackDurationSeconds: number,
): Promise<RecordingCharacteristics> {
  const context = new AudioContext();

  try {
    const audioBuffer = await context.decodeAudioData(await blob.arrayBuffer());
    const frameSize = Math.max(512, Math.floor(audioBuffer.sampleRate * 0.025));
    const frameLevels: number[] = [];
    let clippedSamples = 0;
    let inspectedSamples = 0;

    for (let frameStart = 0; frameStart < audioBuffer.length; frameStart += frameSize) {
      const frameEnd = Math.min(audioBuffer.length, frameStart + frameSize);
      let squareSum = 0;
      let frameSamples = 0;

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
        const samples = audioBuffer.getChannelData(channel);

        for (let index = frameStart; index < frameEnd; index += 2) {
          const sample = samples[index];
          squareSum += sample * sample;
          frameSamples += 1;
          inspectedSamples += 1;
          if (Math.abs(sample) >= 0.985) {
            clippedSamples += 1;
          }
        }
      }

      frameLevels.push(Math.sqrt(squareSum / Math.max(frameSamples, 1)));
    }

    const sortedLevels = [...frameLevels].sort((left, right) => left - right);
    const upperLevel = percentile(sortedLevels, 0.9);
    const activeThreshold = Math.max(0.0025, upperLevel * 0.1);
    const activeLevels = frameLevels.filter((level) => level > activeThreshold);
    const usableLevels = activeLevels.length >= 3 ? activeLevels : frameLevels;
    const meanLevel = average(usableLevels);
    const variance = average(
      usableLevels.map((level) => (level - meanLevel) ** 2),
    );
    const deviation = Math.sqrt(variance);
    const orderedActiveLevels = [...usableLevels].sort((left, right) => left - right);
    const lowerActiveLevel = percentile(orderedActiveLevels, 0.1);
    const upperActiveLevel = percentile(orderedActiveLevels, 0.9);
    const clippingRatio = clippedSamples / Math.max(inspectedSamples, 1);
    const activeCoverage = activeLevels.length / Math.max(frameLevels.length, 1);

    const volumeStability = clamp(1 - (deviation / Math.max(meanLevel, 0.001)) * 0.72);
    const volumeVariation = clamp(
      (upperActiveLevel - lowerActiveLevel) / Math.max(upperActiveLevel, 0.001),
    );
    const levelQuality =
      meanLevel < 0.025
        ? clamp(meanLevel / 0.025)
        : meanLevel > 0.32
          ? clamp(1 - (meanLevel - 0.32) * 2.2)
          : 1;
    const recordingQuality = clamp(
      levelQuality * 0.58 +
        (1 - clamp(clippingRatio * 120)) * 0.27 +
        clamp(activeCoverage / 0.7) * 0.15,
    );
    const voicePresence = clamp(activeCoverage / 0.65);
    const signature = fingerprintAudio(audioBuffer.getChannelData(0));

    return {
      attemptId: `attempt-${++attemptSequence}-${signature}`,
      volumeStability,
      volumeVariation,
      recordingQuality,
      voicePresence,
      durationSeconds: audioBuffer.duration || fallbackDurationSeconds,
      signature,
    };
  } finally {
    await context.close();
  }
}

export async function extractRecordingCharacteristics(
  blob: Blob,
  durationSeconds: number,
): Promise<RecordingCharacteristics> {
  try {
    return await decodeCharacteristics(blob, durationSeconds);
  } catch {
    return createFallbackCharacteristics(blob, durationSeconds);
  }
}
