import type {
  PraiseWord,
  SpeechAnalysisInput,
  SpeechAnalyzer,
  SpeechFeedbackResult,
  SupportedStarRating,
} from "./types.js";

type FeedbackDimension = "rhythm" | "fluency" | "clarity";

const FEEDBACK_MESSAGES: Record<
  FeedbackDimension,
  Record<SupportedStarRating, readonly string[]>
> = {
  rhythm: {
    3.5: [
      "Your rhythm is growing with each reading.",
      "You are building a steady reading rhythm.",
    ],
    4: [
      "Your sense of rhythm is developing well.",
      "Your reading is finding a steady rhythm.",
    ],
    4.5: [
      "Your rhythm is steady and expressive.",
      "Your phrasing carries a confident beat.",
    ],
    5: [
      "Your rhythm feels natural and expressive.",
      "Your stress and pauses sound beautifully balanced.",
    ],
  },
  fluency: {
    3.5: [
      "Your reading is becoming more connected.",
      "Keep linking each phrase with confidence.",
    ],
    4: [
      "Your reading shows good flow and control.",
      "You keep the story moving at a good pace.",
    ],
    4.5: [
      "Your reading flows with growing confidence.",
      "Your delivery feels smooth and well paced.",
    ],
    5: [
      "Your speech flows smoothly and confidently.",
      "Your reading sounds calm, connected, and fluent.",
    ],
  },
  clarity: {
    3.5: [
      "Your message is becoming easier to follow.",
      "Keep giving each word a clear voice.",
    ],
    4: [
      "Your voice is clear and easy to follow.",
      "Your words come through clearly.",
    ],
    4.5: [
      "Your words are clear and well paced.",
      "Your message sounds clear and thoughtful.",
    ],
    5: [
      "Your message is easy to understand.",
      "Every part of your reading sounds clear.",
    ],
  },
};

const VERY_GOOD_PRAISE: readonly PraiseWord[] = [
  "Amazing!",
  "Brilliant!",
  "Excellent!",
];
const GOOD_PRAISE: readonly PraiseWord[] = ["Wonderful!", "Great Job!"];

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const clampRating = (value: number) => Math.min(5, Math.max(3.5, value));

function seededJitter(signature: number, salt: number): number {
  const raw = Math.sin(signature * 0.000_001 + salt * 12.9898) * 43_758.5453;
  return (raw - Math.floor(raw) - 0.5) * 0.18;
}

function toStarRating(score: number): SupportedStarRating {
  return (Math.round(clampRating(score) * 2) / 2) as SupportedStarRating;
}

function chooseMessage(
  dimension: FeedbackDimension,
  rating: SupportedStarRating,
  signature: number,
  offset: number,
): string {
  const messages = FEEDBACK_MESSAGES[dimension][rating];
  return messages[Math.abs(signature + offset * 17) % messages.length];
}

export class MockAnalyzer implements SpeechAnalyzer {
  async analyze(input: SpeechAnalysisInput): Promise<SpeechFeedbackResult> {
    const expressiveVariation = clamp(
      1 - Math.abs(input.volumeVariation - 0.52) / 0.52,
    );
    const rhythm = toStarRating(
      4 +
        (input.volumeStability - 0.5) * 0.45 +
        (expressiveVariation - 0.5) * 0.5 +
        (input.recordingQuality - 0.5) * 0.35 +
        (input.voicePresence - 0.5) * 0.4 +
        seededJitter(input.signature, 1) * 0.45,
    );
    const fluency = toStarRating(
      4 +
        (input.volumeStability - 0.5) * 0.65 +
        (input.recordingQuality - 0.5) * 0.35 +
        (input.voicePresence - 0.5) * 0.5 +
        seededJitter(input.signature, 2) * 0.4,
    );
    const clarity = toStarRating(
      4 +
        (input.recordingQuality - 0.5) * 0.9 +
        (input.volumeStability - 0.5) * 0.2 +
        (input.voicePresence - 0.5) * 0.55 +
        seededJitter(input.signature, 3) * 0.35,
    );
    const average = (rhythm + fluency + clarity) / 3;
    const praisePool = average >= 4.67 ? VERY_GOOD_PRAISE : GOOD_PRAISE;
    const praise = praisePool[Math.abs(input.signature) % praisePool.length];

    return {
      rhythm,
      fluency,
      clarity,
      praise,
      comments: {
        rhythm: chooseMessage("rhythm", rhythm, input.signature, 0),
        fluency: chooseMessage("fluency", fluency, input.signature, 1),
        clarity: chooseMessage("clarity", clarity, input.signature, 2),
      },
    };
  }
}
