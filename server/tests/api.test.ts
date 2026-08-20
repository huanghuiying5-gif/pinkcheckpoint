import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../app.js";
import { ReadingPassageStore } from "../database/ReadingPassageStore.js";
import {
  AudioNormalizationError,
} from "../services/audio/AudioNormalizationService.js";
import type {
  AudioNormalizer,
  NormalizedAudio,
} from "../services/audio/AudioNormalizationService.js";
import { MockAnalyzer } from "../../src/services/analysis/mockAnalyzer.js";
import { SpeechAnalysisService } from "../../src/services/analysis/speechAnalysisService.js";
import { SAFE_CLASSROOM_FEEDBACK } from "../../src/services/analysis/types.js";
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

const RECORDING = {
  attemptId: "classroom-attempt",
  volumeStability: 0.74,
  volumeVariation: 0.51,
  recordingQuality: 0.82,
  voicePresence: 0.9,
  durationSeconds: 24,
  signature: 12345,
};

const NORMALIZED_AUDIO: NormalizedAudio = {
  data: Buffer.alloc(32_000),
  format: "pcm_s16le",
  sampleRate: 16_000,
  channels: 1,
  bitDepth: 16,
  durationMs: 1_000,
};

class CapturingAudioNormalizer implements AudioNormalizer {
  calls = 0;
  input: { data: Buffer; mimeType: string } | null = null;

  async normalize(input: { data: Buffer; mimeType: string }): Promise<NormalizedAudio> {
    this.calls += 1;
    this.input = input;
    return NORMALIZED_AUDIO;
  }
}

class FailingAudioNormalizer implements AudioNormalizer {
  async normalize(): Promise<NormalizedAudio> {
    throw new AudioNormalizationError(
      "FFMPEG_UNAVAILABLE",
      "FFmpeg is unavailable in this test.",
    );
  }
}

class CapturingAnalyzer implements SpeechAnalyzer {
  input: SpeechAnalysisInput | null = null;

  async analyze(input: SpeechAnalysisInput): Promise<SpeechFeedbackResult> {
    this.input = input;
    return SAFE_CLASSROOM_FEEDBACK;
  }
}

interface TestAppOptions {
  audioNormalizer?: AudioNormalizer;
  audioUploadMaxBytes?: number;
  mockAnalyzer?: SpeechAnalyzer;
}

function createTestApp(options: TestAppOptions = {}) {
  const store = new ReadingPassageStore(":memory:");
  const speechAnalysis = new SpeechAnalysisService({
    mode: "mock",
    mockAnalyzer: options.mockAnalyzer ?? new MockAnalyzer(),
    xunfeiAnalyzer: new XunfeiAnalyzer(),
  });
  const app = createApp({
    store,
    auth: TEST_AUTH,
    speechAnalysis,
    audioNormalizer: options.audioNormalizer,
    audioUploadMaxBytes: options.audioUploadMaxBytes,
  });
  return { app, store };
}

test("GET /api/reading-passage loads the initialized passage", async (context) => {
  const { app, store } = createTestApp();
  context.after(() => store.close());

  const response = await request(app).get("/api/reading-passage").expect(200);

  assert.equal(response.body.id, "current_reading_passage");
  assert.equal(response.body.revision, 1);
  assert.match(response.body.content, /Welcome to Shangrao/);
});

test("PUT /api/reading-passage rejects an unauthenticated save", async (context) => {
  const { app, store } = createTestApp();
  context.after(() => store.close());

  await request(app)
    .put("/api/reading-passage")
    .send({ content: "A protected classroom passage." })
    .expect(401);
});

test("POST /api/setup/login rejects an incorrect password", async (context) => {
  const { app, store } = createTestApp();
  context.after(() => store.close());

  await request(app)
    .post("/api/setup/login")
    .send({ password: "incorrect-password" })
    .expect(401);

  const session = await request(app).get("/api/setup/session").expect(200);
  assert.equal(session.body.authenticated, false);
});

test("a valid login establishes a session and permits saving", async (context) => {
  const { app, store } = createTestApp();
  context.after(() => store.close());
  const agent = request.agent(app);

  const login = await agent
    .post("/api/setup/login")
    .send({ password: TEST_AUTH.password })
    .expect(200);

  assert.equal(login.body.authenticated, true);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Lax/);

  const session = await agent.get("/api/setup/session").expect(200);
  assert.equal(session.body.authenticated, true);

  const updatedContent =
    "The class reads this newly saved passage together with clear voices.";
  const saved = await agent
    .put("/api/reading-passage")
    .send({ content: updatedContent })
    .expect(200);

  assert.equal(saved.body.content, updatedContent);
  assert.equal(saved.body.revision, 2);

  const publicRead = await request(app).get("/api/reading-passage").expect(200);
  assert.equal(publicRead.body.content, updatedContent);
  assert.equal(publicRead.body.revision, 2);
});

test("POST /api/speech-analysis accepts multipart audio and preserves provider input", async (context) => {
  const normalizer = new CapturingAudioNormalizer();
  const analyzer = new CapturingAnalyzer();
  const { app, store } = createTestApp({
    audioNormalizer: normalizer,
    mockAnalyzer: analyzer,
  });
  context.after(() => store.close());

  const response = await request(app)
    .post("/api/speech-analysis")
    .field("recording", JSON.stringify(RECORDING))
    .field("referenceText", "Read this passage aloud with confidence.")
    .field("passageRevision", "7")
    .attach("audio", Buffer.from("browser-audio"), {
      filename: "recording.webm",
      contentType: "audio/webm;codecs=opus",
    })
    .expect(200);

  assert.ok([3.5, 4, 4.5, 5].includes(response.body.rhythm));
  assert.ok([3.5, 4, 4.5, 5].includes(response.body.fluency));
  assert.ok([3.5, 4, 4.5, 5].includes(response.body.clarity));
  assert.equal(typeof response.body.praise, "string");
  assert.deepEqual(Object.keys(response.body.comments).sort(), [
    "clarity",
    "fluency",
    "rhythm",
  ]);
  assert.equal("provider" in response.body, false);
  assert.equal(normalizer.calls, 1);
  assert.equal(normalizer.input?.mimeType, "audio/webm");
  assert.equal(normalizer.input?.data.toString(), "browser-audio");
  assert.equal(analyzer.input?.referenceText, "Read this passage aloud with confidence.");
  assert.equal(analyzer.input?.passageRevision, 7);
  assert.equal(analyzer.input?.audio?.normalized.sampleRate, 16_000);
});

test("missing audio still returns mock feedback when characteristics are valid", async (context) => {
  const analyzer = new CapturingAnalyzer();
  const { app, store } = createTestApp({ mockAnalyzer: analyzer });
  context.after(() => store.close());

  const response = await request(app)
    .post("/api/speech-analysis")
    .field("recording", JSON.stringify(RECORDING))
    .field("referenceText", "Read this passage aloud with confidence.")
    .expect(200);

  assert.deepEqual(response.body, SAFE_CLASSROOM_FEEDBACK);
  assert.equal(analyzer.input?.audio, undefined);
  assert.equal(analyzer.input?.referenceText, "Read this passage aloud with confidence.");
});

test("unsupported MIME uploads fall back without exposing a technical error", async (context) => {
  const normalizer = new CapturingAudioNormalizer();
  const analyzer = new CapturingAnalyzer();
  const { app, store } = createTestApp({
    audioNormalizer: normalizer,
    mockAnalyzer: analyzer,
  });
  context.after(() => store.close());

  const response = await request(app)
    .post("/api/speech-analysis")
    .field("recording", JSON.stringify(RECORDING))
    .field("referenceText", "Read this passage aloud with confidence.")
    .attach("audio", Buffer.from("unsupported"), {
      filename: "recording.ogg",
      contentType: "audio/ogg",
    })
    .expect(200);

  assert.deepEqual(response.body, SAFE_CLASSROOM_FEEDBACK);
  assert.equal(normalizer.calls, 0);
  assert.equal(analyzer.input?.audio, undefined);
});

test("oversized uploads fall back without invoking normalization", async (context) => {
  const normalizer = new CapturingAudioNormalizer();
  const analyzer = new CapturingAnalyzer();
  const { app, store } = createTestApp({
    audioNormalizer: normalizer,
    audioUploadMaxBytes: 4,
    mockAnalyzer: analyzer,
  });
  context.after(() => store.close());

  const response = await request(app)
    .post("/api/speech-analysis")
    .field("recording", JSON.stringify(RECORDING))
    .field("referenceText", "Read this passage aloud with confidence.")
    .attach("audio", Buffer.from("more-than-four-bytes"), {
      filename: "recording.webm",
      contentType: "audio/webm",
    })
    .expect(200);

  assert.deepEqual(response.body, SAFE_CLASSROOM_FEEDBACK);
  assert.equal(normalizer.calls, 0);
  assert.equal(analyzer.input?.audio, undefined);
});

test("normalization failures automatically fall back to mock feedback", async (context) => {
  const analyzer = new CapturingAnalyzer();
  const { app, store } = createTestApp({
    audioNormalizer: new FailingAudioNormalizer(),
    mockAnalyzer: analyzer,
  });
  context.after(() => store.close());

  const response = await request(app)
    .post("/api/speech-analysis")
    .field("recording", JSON.stringify(RECORDING))
    .field("referenceText", "Read this passage aloud with confidence.")
    .attach("audio", Buffer.from("browser-audio"), {
      filename: "recording.webm",
      contentType: "audio/webm",
    })
    .expect(200);

  assert.deepEqual(response.body, SAFE_CLASSROOM_FEEDBACK);
  assert.equal("error" in response.body, false);
  assert.equal(analyzer.input?.audio, undefined);
});
