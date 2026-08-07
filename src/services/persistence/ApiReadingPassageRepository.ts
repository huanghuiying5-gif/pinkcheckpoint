import type {
  ReadingPassage,
  SaveReadingPassageInput,
} from "../../types";
import type { ReadingPassageRepository } from "./ReadingPassageRepository";

export class ReadingPassageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReadingPassageApiError";
  }
}

async function parseResponse(response: Response): Promise<ReadingPassage> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ReadingPassageApiError(
      body?.error ?? "The reading passage request failed.",
      response.status,
    );
  }

  return (await response.json()) as ReadingPassage;
}

export class ApiReadingPassageRepository
  implements ReadingPassageRepository
{
  constructor(private readonly apiBaseUrl = "") {}

  async getLatest(signal?: AbortSignal): Promise<ReadingPassage | null> {
    const response = await fetch(`${this.apiBaseUrl}/api/reading-passage`, {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal,
    });

    return parseResponse(response);
  }

  async saveLatest(
    input: SaveReadingPassageInput,
    signal?: AbortSignal,
  ): Promise<ReadingPassage> {
    const response = await fetch(`${this.apiBaseUrl}/api/reading-passage`, {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal,
    });

    return parseResponse(response);
  }
}
