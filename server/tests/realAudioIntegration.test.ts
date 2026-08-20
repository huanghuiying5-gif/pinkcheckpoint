import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import request from "supertest";

import { createApp } from "../app.js";
import { ReadingPassageStore } from "../database/ReadingPassageStore.js";
import { AudioNormalizationService } from "../services/audio/AudioNormalizationService.js";
import { MockAnalyzer } from "../../src/services/analysis/mockAnalyzer.js";
import { SpeechAnalysisService } from "../../src/services/analysis/speechAnalysisService.js";
import type {
  SpeechAnalysisInput,
  SpeechAnalyzer,
  SpeechFeedbackResult,
} from "../../src/services/analysis/types.js";
import { XunfeiAnalyzer } from "../../src/services/analysis/xunfeiAnalyzer.js";

const TEST_AUTH = {
  password: "correct-horse-battery-staple",
  sessionSecret: "test-session-secret-with-at-least-32-characters",
  sessionTtlMs: 60 * 60 * 1_000,
  secureCookie: false,
};
const FFMPEG_PATH = process.env.FFMPEG_PATH?.trim() || "ffmpeg";

class CapturingMockAnalyzer implements SpeechAnalyzer {
  private readonly mock = new MockAnalyzer();
  input: SpeechAnalysisInput | null = null;

  async analyze(input: SpeechAnalysisInput): Promise<SpeechFeedbackResult> {
    this.input = input;
    return this.mock.analyze(input);
  }
}

function hasFfmpeg(): boolean {
  return spawnSync(FFMPEG_PATH, ["-version"], { stdio: "ignore" }).status === 0;
}

function createWebmOpusSample(): Buffer {
  const generated = spawnSync(
    FFMPEG_PATH,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000",
      "-t",
      "0.25",
      "-ac",
      "1",
      "-c:a",
      "libopus",
      "-f",
      "webm",
      "pipe:1",
    ],
    { encoding: null, timeout: 15_000 },
  );

  if (generated.status !== 0 || !generated.stdout?.length) {
    throw new Error(
      generated.stderr?.toString() || "Unable to create a WebM/Opus test sample.",
    );
  }

  return generated.stdout;
}

test(
  "real WebM/Opus upload reaches the mock provider as normalized PCM",
  { skip: !hasFfmpeg() },
  async (context) => {
    const store = new ReadingPassageStore(":memory:");
    context.after(() => store.close());
    const mockAnalyzer = new CapturingMockAnalyzer();
    const speechAnalysis = new SpeechAnalysisService({
      mode: "mock",
      mockAnalyzer,
      xunfeiAnalyzer: new XunfeiAnalyzer(),
    });
    const app = createApp({
      store,
      auth: TEST_AUTH,
      speechAnalysis,
      audioNormalizer: new AudioNormalizationService({
        ffmpegPath: FFMPEG_PATH,
        timeoutMs: 15_000,
      }),
    });

    const sample = createWebmOpusSample();
    const response = await request(app)
      .post("/api/speech-analysis")
      .field(
        "recording",
        JSON.stringify({
          attemptId: "real-webm-opus-attempt",
          volumeStability: 0.74,
          volumeVariation: 0.51,
          recordingQuality: 0.82,
          voicePresence: 0.9,
          durationSeconds: 0.25,
          signature: 12345,
        }),
      )
      .field("referenceText", "A calm voice carries the story clearly.")
      .field("passageRevision", "9")
      .attach("audio", sample, {
        filename: "recording.webm",
        contentType: "audio/webm;codecs=opus",
      })
      .expect(200);

    const normalized = mockAnalyzer.input?.audio?.normalized;
    assert.ok(normalized);
    assert.equal(normalized.format, "pcm_s16le");
    assert.equal(normalized.sampleRate, 16_000);
    assert.equal(normalized.channels, 1);
    assert.equal(normalized.bitDepth, 16);
    assert.ok(normalized.data.length > 0);
    assert.ok(normalized.durationMs > 0);
    assert.equal(normalized.data.length % 2, 0);
    assert.equal(
      normalized.durationMs,
      Math.round((normalized.data.length / (16_000 * 2)) * 1_000),
    );
    assert.equal(mockAnalyzer.input?.referenceText, "A calm voice carries the story clearly.");
    assert.equal(mockAnalyzer.input?.passageRevision, 9);
    assert.ok([3.5, 4, 4.5, 5].includes(response.body.rhythm));
    assert.ok([3.5, 4, 4.5, 5].includes(response.body.fluency));
    assert.ok([3.5, 4, 4.5, 5].includes(response.body.clarity));
    assert.equal(typeof response.body.praise, "string");
    assert.deepEqual(Object.keys(response.body.comments).sort(), [
      "clarity",
      "fluency",
      "rhythm",
    ]);
    assert.equal("error" in response.body, false);
  },
);
