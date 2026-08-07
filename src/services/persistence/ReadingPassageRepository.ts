import type {
  ReadingPassage,
  SaveReadingPassageInput,
} from "../../types";

/**
 * Persistence port shared by Classroom Mode and Teacher Setup.
 * Concrete adapters keep transport and storage details out of route components.
 */
export interface ReadingPassageRepository {
  getLatest(signal?: AbortSignal): Promise<ReadingPassage | null>;

  saveLatest(
    input: SaveReadingPassageInput,
    signal?: AbortSignal,
  ): Promise<ReadingPassage>;
}
