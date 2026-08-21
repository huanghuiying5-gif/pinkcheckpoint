import "dotenv/config";

import { resolve } from "node:path";

import { createApp } from "./app.js";
import { loadServerConfig } from "./config.js";
import { ReadingPassageStore } from "./database/ReadingPassageStore.js";
import { AudioNormalizationService } from "./services/audio/AudioNormalizationService.js";
import { MockAnalyzer } from "../src/services/analysis/mockAnalyzer.js";
import { SpeechAnalysisService } from "../src/services/analysis/speechAnalysisService.js";
import { XunfeiAnalyzer } from "./services/analysis/xunfei/XunfeiAnalyzer.js";

const config = loadServerConfig();
const store = new ReadingPassageStore(config.databasePath);
const speechAnalysis = new SpeechAnalysisService({
  mode: config.aiMode,
  mockAnalyzer: new MockAnalyzer(),
  xunfeiAnalyzer: new XunfeiAnalyzer(config.xunfei),
});
const audioNormalizer = new AudioNormalizationService({
  ffmpegPath: config.ffmpegPath,
  timeoutMs: config.audioNormalizationTimeoutMs,
});
const app = createApp({
  store,
  speechAnalysis,
  audioNormalizer,
  audioUploadMaxBytes: config.audioUploadMaxBytes,
  auth: {
    password: config.teacherPassword,
    sessionSecret: config.sessionSecret,
    sessionTtlMs: config.sessionTtlMs,
    secureCookie: config.secureCookie,
  },
  frontendDistPath:
    process.env.NODE_ENV === "production" ? resolve("dist") : undefined,
});

const server = app.listen(config.port, () => {
  if (process.env.NODE_ENV === "production") {
    console.log(`Speak with Rhythm is running on http://localhost:${config.port}`);
    return;
  }

  console.log(
    `Speak with Rhythm API is running on http://localhost:${config.port}/api`,
  );
  console.log("Open Classroom Mode at http://localhost:5173/");
});

const shutdown = () => {
  server.close(() => {
    store.close();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
