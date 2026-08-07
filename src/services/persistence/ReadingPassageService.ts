import type {
  ReadingPassage,
  SaveReadingPassageInput,
} from "../../types";
import type { ReadingPassageRepository } from "./ReadingPassageRepository";

export class InvalidReadingPassageError extends Error {
  readonly code = "INVALID_READING_PASSAGE";

  constructor(message: string) {
    super(message);
    this.name = "InvalidReadingPassageError";
  }
}

/**
 * Application-facing service for reading-passage persistence.
 * Route and feature code depend on this service rather than a storage mechanism.
 */
export class ReadingPassageService {
  constructor(private readonly repository: ReadingPassageRepository) {}

  getLatest(signal?: AbortSignal): Promise<ReadingPassage | null> {
    return this.repository.getLatest(signal);
  }

  saveLatest(
    input: SaveReadingPassageInput,
    signal?: AbortSignal,
  ): Promise<ReadingPassage> {
    const content = input.content.trim();

    if (!content) {
      throw new InvalidReadingPassageError(
        "A reading passage must contain text before it can be saved.",
      );
    }

    return this.repository.saveLatest({ content }, signal);
  }
}
