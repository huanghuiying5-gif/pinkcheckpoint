import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadServerConfig } from "../config.js";
import { XunfeiAnalyzer } from "../services/analysis/xunfei/XunfeiAnalyzer.js";
import { mapXunfeiRawResult } from "../services/analysis/xunfei/XunfeiAnalyzer.js";
import type { XunfeiStreamingMetrics } from "../services/analysis/xunfei/XunfeiTypes.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): never {
  console.error(
    "Usage: XFYUN_LIVE_TEST=1 npm run test:xunfei-live -- --audio <normalized.pcm> --text <matching reading passage>",
  );
  process.exit(1);
}

if (process.env.XFYUN_LIVE_TEST !== "1") {
  console.error("Refusing live Xunfei request. Set XFYUN_LIVE_TEST=1 to opt in.");
  process.exit(1);
}

const audioPath = argument("--audio");
const referenceText = argument("--text");
if (!audioPath || !referenceText) {
  usage();
}

const startedAt = Date.now();
let streamingMetrics: XunfeiStreamingMetrics | undefined;
try {
  const data = await readFile(resolve(audioPath));
  if (!data.byteLength) {
    throw new Error("The normalized PCM file is empty.");
  }
  const config = loadServerConfig();
  const analyzer = new XunfeiAnalyzer(config.xunfei);
  const raw = await analyzer.evaluateRaw({
    attemptId: "xunfei-live-test",
    volumeStability: 0.8,
    volumeVariation: 0.5,
    recordingQuality: 0.9,
    voicePresence: 0.9,
    durationSeconds: data.byteLength / 32_000,
    signature: 0,
    referenceText,
    audio: {
      original: { mimeType: "audio/L16", byteLength: data.byteLength },
      normalized: {
        data,
        format: "pcm_s16le",
        sampleRate: 16_000,
        channels: 1,
        bitDepth: 16,
        durationMs: (data.byteLength / 32_000) * 1_000,
      },
    },
  }, (metrics) => {
    streamingMetrics = metrics;
  });
  const feedback = mapXunfeiRawResult(raw);

  console.log("WebSocket authentication succeeded.");
  console.log("Xunfei accepted the evaluation request.");
  console.log(`sid: ${raw.sid}`);
  console.log(`audioDurationMs: ${Math.round((data.byteLength / 32_000) * 1_000)}`);
  console.log(`frameBytes: ${config.xunfei.frameBytes}`);
  console.log(`frameIntervalMs: ${config.xunfei.frameIntervalMs}`);
  console.log(`audioFramesSent: ${streamingMetrics?.audioFramesSent ?? 0}`);
  console.log(`audioSendDurationMs: ${streamingMetrics?.audioSendDurationMs ?? 0}`);
  console.log("score fields:", {
    accuracyScore: raw.accuracyScore,
    fluencyScore: raw.fluencyScore,
    integrityScore: raw.integrityScore,
    standardScore: raw.standardScore,
    totalScore: raw.totalScore,
    wordCount: raw.wordCount,
  });
  console.log("calibrated feedback:", {
    rhythm: feedback.rhythm,
    fluency: feedback.fluency,
    clarity: feedback.clarity,
    praise: feedback.praise,
  });
  console.log(`elapsedMs: ${Date.now() - startedAt}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown Xunfei live test failure.";
  console.error(`Xunfei connection failed: ${message}`);
  console.error(`elapsedMs: ${Date.now() - startedAt}`);
  process.exitCode = 1;
}
