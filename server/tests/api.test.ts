import assert from "node:assert/strict";
import test from "node:test";

import request from "supertest";

import { createApp } from "../app.js";
import { ReadingPassageStore } from "../database/ReadingPassageStore.js";
import { MockAnalyzer } from "../../src/services/analysis/mockAnalyzer.js";
import { SpeechAnalysisService } from "../../src/services/analysis/speechAnalysisService.js";
import { XunfeiAnalyzer } from "../../src/services/analysis/xunfeiAnalyzer.js";

const TEST_AUTH = {
  password: "correct-horse-battery-staple",
  sessionSecret: "test-session-secret-with-at-least-32-characters",
  sessionTtlMs: 60 * 60 * 1_000,
  secureCookie: false,
};

function createTestApp() {
  const store = new ReadingPassageStore(":memory:");
  const speechAnalysis = new SpeechAnalysisService({
    mode: "mock",
    mockAnalyzer: new MockAnalyzer(),
    xunfeiAnalyzer: new XunfeiAnalyzer(),
  });
  const app = createApp({ store, auth: TEST_AUTH, speechAnalysis });
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

test("POST /api/speech-analysis returns the provider-independent contract", async (context) => {
  const { app, store } = createTestApp();
  context.after(() => store.close());

  const response = await request(app)
    .post("/api/speech-analysis")
    .send({
      recording: {
        attemptId: "classroom-attempt",
        volumeStability: 0.74,
        volumeVariation: 0.51,
        recordingQuality: 0.82,
        voicePresence: 0.9,
        durationSeconds: 24,
        signature: 12345,
      },
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
});
