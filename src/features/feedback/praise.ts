export const PRAISE_OPTIONS = [
  "Great Job!",
  "Wonderful!",
  "Excellent!",
  "Amazing!",
  "Brilliant!",
] as const;

export type PraiseWord = (typeof PRAISE_OPTIONS)[number];

/** Reserved for future spoken praise assets; intentionally empty in Phase 1. */
export const PRAISE_AUDIO_SOURCES: Partial<Record<PraiseWord, string>> = {};

export function choosePraiseWord(): PraiseWord {
  return PRAISE_OPTIONS[Math.floor(Math.random() * PRAISE_OPTIONS.length)];
}
