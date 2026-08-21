import assert from "node:assert/strict";
import test from "node:test";

import { loadServerConfig } from "../config.js";
import { MockAnalyzer } from "../../src/services/analysis/mockAnalyzer.js";
import { SpeechAnalysisService } from "../../src/services/analysis/speechAnalysisService.js";
import { calibrateXunfeiScores } from "../../src/services/analysis/xunfeiScoreCalibration.js";
import type {
  AnalysisLogger,
  SpeechAnalysisInput,
  SpeechAnalyzer,
  SpeechFeedbackResult,
} from "../../src/services/analysis/types.js";

const INPUT: SpeechAnalysisInput = {
  attemptId: "attempt-test",
  volumeStability: 0.72,
  volumeVariation: 0.5,
  recordingQuality: 0.84,
  voicePresence: 0.9,
  durationSeconds: 20,
  signature: 42_424,
};

const XUNFEI_RESULT: SpeechFeedbackResult = {
  rhythm: 5,
  fluency: 4.5,
  clarity: 5,
  praise: "Excellent!",
  comments: {
    rhythm: "Your rhythm feels natural and expressive.",
    fluency: "Your reading flows with growing confidence.",
    clarity: "Your message is easy to understand.",
  },
};

class TrackingAnalyzer implements SpeechAnalyzer {
  calls = 0;

  constructor(
    private readonly result?: SpeechFeedbackResult,
    private readonly failure?: Error,
  ) {}

  async analyze(_input: SpeechAnalysisInput): Promise<SpeechFeedbackResult> {
    this.calls += 1;
    if (this.failure) {
      throw this.failure;
    }
    assert.ok(this.result);
    return this.result;
  }
}

class TestLogger implements AnalysisLogger {
  warnings: Array<{ message: string; details?: Record<string, unknown> }> = [];

  warn(message: string, details?: Record<string, unknown>): void {
    this.warnings.push({ message, details });
  }
}

test("AI_MODE=mock always returns simulated classroom feedback", async () => {
  const mock = new MockAnalyzer();
  const xunfei = new TrackingAnalyzer(XUNFEI_RESULT);
  const service = new SpeechAnalysisService({
    mode: "mock",
    mockAnalyzer: mock,
    xunfeiAnalyzer: xunfei,
  });

  const result = await service.analyze(INPUT);

  assert.ok([3.5, 4, 4.5, 5].includes(result.rhythm));
  assert.ok([3.5, 4, 4.5, 5].includes(result.fluency));
  assert.ok([3.5, 4, 4.5, 5].includes(result.clarity));
  assert.equal(xunfei.calls, 0);
});

test("AI_MODE=xunfei attempts Xunfei and returns its unified result", async () => {
  const xunfei = new TrackingAnalyzer(XUNFEI_RESULT);
  const service = new SpeechAnalysisService({
    mode: "xunfei",
    mockAnalyzer: new MockAnalyzer(),
    xunfeiAnalyzer: xunfei,
  });

  const result = await service.analyze(INPUT);

  assert.equal(xunfei.calls, 1);
  assert.deepEqual(result, XUNFEI_RESULT);
});

test("Xunfei failure is logged on the server and falls back to mock", async () => {
  const xunfei = new TrackingAnalyzer(
    undefined,
    new Error("simulated provider timeout"),
  );
  const mock = new TrackingAnalyzer(XUNFEI_RESULT);
  const logger = new TestLogger();
  const service = new SpeechAnalysisService({
    mode: "xunfei",
    mockAnalyzer: mock,
    xunfeiAnalyzer: xunfei,
    logger,
  });

  const result = await service.analyze(INPUT);

  assert.equal(xunfei.calls, 1);
  assert.equal(mock.calls, 1);
  assert.deepEqual(result, XUNFEI_RESULT);
  assert.equal(logger.warnings.length, 1);
  assert.match(logger.warnings[0].message, /using classroom-safe mock feedback/);
});

test("server environment selects mock and xunfei analysis modes", () => {
  const baseEnvironment = {
    TEACHER_SETUP_PASSWORD: "teacher-test-password",
    SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  };

  assert.equal(
    loadServerConfig({ ...baseEnvironment, AI_MODE: "mock" }).aiMode,
    "mock",
  );
  assert.equal(
    loadServerConfig({ ...baseEnvironment, AI_MODE: "xunfei" }).aiMode,
    "xunfei",
  );

  const audioConfig = loadServerConfig({
    ...baseEnvironment,
    FFMPEG_PATH: "C:/tools/ffmpeg.exe",
    AUDIO_UPLOAD_MAX_BYTES: "15728640",
    AUDIO_NORMALIZATION_TIMEOUT_MS: "15000",
  });
  assert.equal(audioConfig.ffmpegPath, "C:/tools/ffmpeg.exe");
  assert.equal(audioConfig.audioUploadMaxBytes, 15_728_640);
  assert.equal(audioConfig.audioNormalizationTimeoutMs, 15_000);
});

test("mock scoring lowers reflection gently when no voice signal is present", async () => {
  const result = await new MockAnalyzer().analyze({
    ...INPUT,
    volumeStability: 0,
    volumeVariation: 0,
    recordingQuality: 0,
    voicePresence: 0,
  });

  assert.equal(result.rhythm, 3.5);
  assert.equal(result.fluency, 3.5);
  assert.equal(result.clarity, 3.5);
  assert.match(result.comments.clarity, /becoming|clear voice/);
});

test("Xunfei raw scores are calibrated before reaching the UI contract", () => {
  assert.deepEqual(
    calibrateXunfeiScores({
      accuracy: 85,
      fluency: 78,
      completeness: 95,
    }),
    {
      rhythm: 4,
      fluency: 3.5,
      clarity: 4.5,
    },
  );
});

test("Xunfei standard score is the primary rhythm signal when supplied", () => {
  const lowerStandard = calibrateXunfeiScores({
    accuracy: 95,
    fluency: 90,
    completeness: 95,
    standard: 76,
  });
  const higherStandard = calibrateXunfeiScores({
    accuracy: 95,
    fluency: 90,
    completeness: 95,
    standard: 96,
  });
  assert.ok(higherStandard.rhythm > lowerStandard.rhythm);
});
