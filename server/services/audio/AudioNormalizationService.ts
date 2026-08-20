import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";

export const NORMALIZED_AUDIO_FORMAT = "pcm_s16le" as const;
export const NORMALIZED_SAMPLE_RATE = 16_000 as const;
export const NORMALIZED_CHANNELS = 1 as const;
export const NORMALIZED_BIT_DEPTH = 16 as const;

const BYTES_PER_SAMPLE = NORMALIZED_BIT_DEPTH / 8;
const BYTES_PER_SECOND =
  NORMALIZED_SAMPLE_RATE * NORMALIZED_CHANNELS * BYTES_PER_SAMPLE;
const MAX_DIAGNOSTIC_BYTES = 8 * 1024;
const MAX_NORMALIZED_OUTPUT_BYTES = 30 * 60 * BYTES_PER_SECOND;

const FFMPEG_ARGUMENTS = [
  "-hide_banner",
  "-loglevel",
  "error",
  "-i",
  "pipe:0",
  "-vn",
  "-ac",
  String(NORMALIZED_CHANNELS),
  "-ar",
  String(NORMALIZED_SAMPLE_RATE),
  "-acodec",
  NORMALIZED_AUDIO_FORMAT,
  "-f",
  "s16le",
  "pipe:1",
];

export interface AudioNormalizationInput {
  data: Buffer;
  mimeType: string;
}

export interface NormalizedAudio {
  data: Buffer;
  format: typeof NORMALIZED_AUDIO_FORMAT;
  sampleRate: typeof NORMALIZED_SAMPLE_RATE;
  channels: typeof NORMALIZED_CHANNELS;
  bitDepth: typeof NORMALIZED_BIT_DEPTH;
  durationMs: number;
}

export interface AudioNormalizer {
  normalize(input: AudioNormalizationInput): Promise<NormalizedAudio>;
}

export type FfmpegSpawner = (
  command: string,
  arguments_: string[],
  options: { stdio: ["pipe", "pipe", "pipe"] },
) => ChildProcessWithoutNullStreams;

export interface AudioNormalizationServiceOptions {
  ffmpegPath: string;
  timeoutMs: number;
  spawnProcess?: FfmpegSpawner;
}

export class AudioNormalizationError extends Error {
  constructor(
    readonly code:
      | "EMPTY_INPUT"
      | "FFMPEG_UNAVAILABLE"
      | "FFMPEG_TIMEOUT"
      | "FFMPEG_FAILED"
      | "OUTPUT_TOO_LARGE"
      | "INVALID_OUTPUT",
    message: string,
  ) {
    super(message);
    this.name = "AudioNormalizationError";
  }
}

const nodeSpawner: FfmpegSpawner = (command, arguments_, options) =>
  spawn(command, arguments_, options) as ChildProcessWithoutNullStreams;

function diagnosticText(chunks: Buffer[]): string {
  return Buffer.concat(chunks).toString("utf8").trim().slice(0, MAX_DIAGNOSTIC_BYTES);
}

export class AudioNormalizationService implements AudioNormalizer {
  private readonly spawnProcess: FfmpegSpawner;

  constructor(private readonly options: AudioNormalizationServiceOptions) {
    this.spawnProcess = options.spawnProcess ?? nodeSpawner;
  }

  async normalize(input: AudioNormalizationInput): Promise<NormalizedAudio> {
    if (input.data.length === 0) {
      throw new AudioNormalizationError(
        "EMPTY_INPUT",
        "The uploaded recording is empty.",
      );
    }

    return new Promise<NormalizedAudio>((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let outputLength = 0;
      const outputChunks: Buffer[] = [];
      const diagnosticChunks: Buffer[] = [];

      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeout) {
          clearTimeout(timeout);
        }
        callback();
      };

      const fail = (error: AudioNormalizationError) => {
        settle(() => reject(error));
      };

      try {
        child = this.spawnProcess(this.options.ffmpegPath, FFMPEG_ARGUMENTS, {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown spawn failure";
        fail(
          new AudioNormalizationError(
            "FFMPEG_UNAVAILABLE",
            `FFmpeg could not be started: ${reason}`,
          ),
        );
        return;
      }

      timeout = setTimeout(() => {
        child.kill("SIGKILL");
        fail(
          new AudioNormalizationError(
            "FFMPEG_TIMEOUT",
            `FFmpeg did not finish within ${this.options.timeoutMs}ms.`,
          ),
        );
      }, this.options.timeoutMs);

      child.stdout.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.from(chunk);
        outputLength += buffer.length;
        if (outputLength > MAX_NORMALIZED_OUTPUT_BYTES) {
          child.kill("SIGKILL");
          fail(
            new AudioNormalizationError(
              "OUTPUT_TOO_LARGE",
              "Normalized audio exceeded the classroom duration limit.",
            ),
          );
          return;
        }
        outputChunks.push(buffer);
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        const remaining = MAX_DIAGNOSTIC_BYTES - diagnosticChunks.reduce(
          (total, value) => total + value.length,
          0,
        );
        if (remaining > 0) {
          diagnosticChunks.push(Buffer.from(chunk).subarray(0, remaining));
        }
      });

      child.once("error", (error) => {
        fail(
          new AudioNormalizationError(
            "FFMPEG_UNAVAILABLE",
            `FFmpeg process error: ${error.message}`,
          ),
        );
      });

      child.stdin.once("error", (error) => {
        fail(
          new AudioNormalizationError(
            "FFMPEG_FAILED",
            `Unable to pass recording data to FFmpeg: ${error.message}`,
          ),
        );
      });

      child.once("close", (code) => {
        if (code !== 0) {
          const diagnostic = diagnosticText(diagnosticChunks);
          fail(
            new AudioNormalizationError(
              "FFMPEG_FAILED",
              `FFmpeg exited with code ${code ?? "unknown"}.${
                diagnostic ? ` ${diagnostic}` : ""
              }`,
            ),
          );
          return;
        }

        const data = Buffer.concat(outputChunks);
        if (data.length === 0 || data.length % BYTES_PER_SAMPLE !== 0) {
          fail(
            new AudioNormalizationError(
              "INVALID_OUTPUT",
              "FFmpeg returned invalid signed 16-bit PCM output.",
            ),
          );
          return;
        }

        settle(() =>
          resolve({
            data,
            format: NORMALIZED_AUDIO_FORMAT,
            sampleRate: NORMALIZED_SAMPLE_RATE,
            channels: NORMALIZED_CHANNELS,
            bitDepth: NORMALIZED_BIT_DEPTH,
            durationMs: Math.round((data.length / BYTES_PER_SECOND) * 1_000),
          }),
        );
      });

      child.stdin.end(input.data);
    });
  }
}
