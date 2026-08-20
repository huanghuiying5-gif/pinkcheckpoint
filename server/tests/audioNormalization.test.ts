import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import {
  AudioNormalizationError,
  AudioNormalizationService,
} from "../services/audio/AudioNormalizationService.js";
import type { FfmpegSpawner } from "../services/audio/AudioNormalizationService.js";

class FakeFfmpegProcess extends EventEmitter {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  killed = false;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

function fakeSpawner(process: FakeFfmpegProcess): FfmpegSpawner {
  return (() => process) as unknown as FfmpegSpawner;
}

test("normalizes FFmpeg output to the provider-ready PCM contract", async () => {
  const process = new FakeFfmpegProcess();
  const service = new AudioNormalizationService({
    ffmpegPath: "ffmpeg",
    timeoutMs: 100,
    spawnProcess: fakeSpawner(process),
  });

  queueMicrotask(() => {
    process.stdout.write(Buffer.alloc(32_000));
    process.emit("close", 0, null);
  });

  const normalized = await service.normalize({
    data: Buffer.from("browser-recording"),
    mimeType: "audio/webm;codecs=opus",
  });

  assert.equal(normalized.format, "pcm_s16le");
  assert.equal(normalized.sampleRate, 16_000);
  assert.equal(normalized.channels, 1);
  assert.equal(normalized.bitDepth, 16);
  assert.equal(normalized.durationMs, 1_000);
  assert.equal(normalized.data.length, 32_000);
});

test("reports an unavailable FFmpeg executable", async () => {
  const service = new AudioNormalizationService({
    ffmpegPath: "not-installed",
    timeoutMs: 100,
    spawnProcess: (() => {
      throw new Error("spawn ENOENT");
    }) as FfmpegSpawner,
  });

  await assert.rejects(
    service.normalize({ data: Buffer.from("audio"), mimeType: "audio/webm" }),
    (error: unknown) =>
      error instanceof AudioNormalizationError &&
      error.code === "FFMPEG_UNAVAILABLE",
  );
});

test("terminates FFmpeg when normalization exceeds its timeout", async () => {
  const process = new FakeFfmpegProcess();
  const service = new AudioNormalizationService({
    ffmpegPath: "ffmpeg",
    timeoutMs: 15,
    spawnProcess: fakeSpawner(process),
  });

  await assert.rejects(
    service.normalize({ data: Buffer.from("audio"), mimeType: "audio/webm" }),
    (error: unknown) =>
      error instanceof AudioNormalizationError && error.code === "FFMPEG_TIMEOUT",
  );
  assert.equal(process.killed, true);
});
