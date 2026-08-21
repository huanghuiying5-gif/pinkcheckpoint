import assert from "node:assert/strict";
import test from "node:test";

import { MockAnalyzer } from "../../src/services/analysis/mockAnalyzer.js";
import { SpeechAnalysisService } from "../../src/services/analysis/speechAnalysisService.js";
import type { SpeechAnalysisInput } from "../../src/services/analysis/types.js";
import { createAuthenticatedXunfeiUrl } from "../services/analysis/xunfei/XunfeiAuth.js";
import { XunfeiAnalyzer } from "../services/analysis/xunfei/XunfeiAnalyzer.js";
import {
  decodeXunfeiFinalXml,
  parseXunfeiEvaluationXml,
} from "../services/analysis/xunfei/XunfeiResultParser.js";
import { XunfeiWebSocketClient } from "../services/analysis/xunfei/XunfeiWebSocketClient.js";
import { XunfeiProviderError } from "../services/analysis/xunfei/XunfeiTypes.js";
import type {
  ResolvedXunfeiProviderConfig,
  XunfeiWebSocket,
} from "../services/analysis/xunfei/XunfeiTypes.js";

const CONFIG: ResolvedXunfeiProviderConfig = {
  appId: "app-id-test",
  apiKey: "api-key-test",
  apiSecret: "api-secret-test",
  iseUrl: "wss://ise-api.xfyun.cn/v2/open-ise",
  requestTimeoutMs: 100,
  frameBytes: 1_280,
  frameIntervalMs: 1,
};

const INPUT: SpeechAnalysisInput = {
  attemptId: "xunfei-test",
  volumeStability: 0.8,
  volumeVariation: 0.4,
  recordingQuality: 0.9,
  voicePresence: 0.9,
  durationSeconds: 0.12,
  signature: 42,
  referenceText: "Read this short English passage aloud.",
  audio: {
    original: { mimeType: "audio/webm", byteLength: 3_840 },
    normalized: {
      data: Buffer.alloc(3_840, 7),
      format: "pcm_s16le",
      sampleRate: 16_000,
      channels: 1,
      bitDepth: 16,
      durationMs: 120,
    },
  },
};

const VALID_XML =
  '<xml_result><read_chapter><rec_paper accuracy_score="94" fluency_score="91" integrity_score="96" standard_score="93" total_score="94" word_count="7" /></read_chapter></xml_result>';

type ListenerMap = {
  open: () => void;
  message: (data: Buffer) => void;
  error: (error: Error) => void;
  close: (code: number) => void;
};

class FakeWebSocket implements XunfeiWebSocket {
  readonly sent: string[] = [];
  readonly listeners: Partial<ListenerMap> = {};
  closeCalls: number[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(code = 1000): void {
    this.closeCalls.push(code);
  }

  on(event: keyof ListenerMap, listener: never): this {
    this.listeners[event] = listener as never;
    return this;
  }

  open(): void {
    this.listeners.open?.();
  }

  message(body: unknown): void {
    this.listeners.message?.(Buffer.from(JSON.stringify(body)));
  }

  error(error: Error): void {
    this.listeners.error?.(error);
  }

  closed(code = 1006): void {
    this.listeners.close?.(code);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createClient(socket: FakeWebSocket, config = CONFIG) {
  return new XunfeiWebSocketClient(config, () => socket);
}

test("Xunfei authentication uses HMAC signing and URL-encoded authorization parameters", () => {
  const url = new URL(
    createAuthenticatedXunfeiUrl(CONFIG, new Date("2025-01-02T03:04:05Z")),
  );
  assert.equal(url.protocol, "wss:");
  assert.equal(url.hostname, "ise-api.xfyun.cn");
  assert.equal(url.searchParams.get("host"), "ise-api.xfyun.cn");
  assert.equal(url.searchParams.get("date"), "Thu, 02 Jan 2025 03:04:05 GMT");
  const authorization = Buffer.from(
    url.searchParams.get("authorization") ?? "",
    "base64",
  ).toString("utf8");
  assert.match(authorization, /api_key="api-key-test"/);
  assert.match(authorization, /algorithm="hmac-sha256"/);
  assert.match(
    authorization,
    /signature="qXa6brjTeBQsR1T4iuqohPKd8Geie\+l9fA0fZtIb\/uE="/,
  );
  assert.equal(url.toString().includes(CONFIG.apiSecret), false);
});

test("the first provider frame uses English read_chapter and a UTF-8 BOM content marker", async () => {
  const socket = new FakeWebSocket();
  const pending = createClient(socket).evaluate({
    audio: INPUT.audio!.normalized.data,
    referenceText: INPUT.referenceText!,
  });
  socket.open();
  const parameterFrame = JSON.parse(socket.sent[0]) as Record<string, any>;
  assert.deepEqual(parameterFrame.common, { app_id: "app-id-test" });
  assert.equal(parameterFrame.business.category, "read_chapter");
  assert.equal(parameterFrame.business.ent, "en_vip");
  assert.equal(parameterFrame.business.text, `\uFEFF[content]\n${INPUT.referenceText}`);
  assert.equal("group" in parameterFrame.business, false);
  assert.equal("grade" in parameterFrame.business, false);
  socket.message({ sid: "sid-frame", code: 0, data: { status: 2, data: Buffer.from(VALID_XML).toString("base64") } });
  await pending;
});

test("audio frames use first, middle, and final Xunfei structures within the byte limit", async () => {
  const socket = new FakeWebSocket();
  const pending = createClient(socket, { ...CONFIG, frameBytes: 19_200, frameIntervalMs: 1 }).evaluate({
    audio: Buffer.alloc(19_201, 5),
    referenceText: INPUT.referenceText!,
  });
  socket.open();
  await delay(8);
  const frames = socket.sent.map((value) => JSON.parse(value));
  const audioFrames = frames.filter((frame) => frame.business?.cmd === "auw");
  assert.equal(audioFrames[0].business.aus, 1);
  assert.equal(audioFrames[1].business.aus, 2);
  assert.equal(audioFrames.at(-1).business.aus, 4);
  for (const frame of audioFrames.slice(0, -1)) {
    assert.ok(Buffer.from(frame.data.data, "base64").byteLength <= 19_200);
  }
  socket.message({ sid: "sid-audio", code: 0, data: { status: 2, data: Buffer.from(VALID_XML).toString("base64") } });
  await pending;
});

test("a non-zero Xunfei response becomes a typed provider error", async () => {
  const socket = new FakeWebSocket();
  const pending = createClient(socket).evaluate({ audio: INPUT.audio!.normalized.data, referenceText: INPUT.referenceText! });
  socket.open();
  socket.message({ sid: "sid-error", code: 10105, message: "invalid credential" });
  await assert.rejects(pending, (error: unknown) =>
    error instanceof XunfeiProviderError && error.providerCode === 10105 && error.sid === "sid-error",
  );
  assert.deepEqual(socket.closeCalls, [1000]);
});

test("final Base64 XML is decoded and robust chapter scores are extracted", () => {
  const decoded = decodeXunfeiFinalXml(Buffer.from(VALID_XML).toString("base64"), "sid-xml");
  const result = parseXunfeiEvaluationXml(`<wrapper>${decoded}</wrapper>`, "sid-xml");
  assert.deepEqual(result, {
    sid: "sid-xml",
    accuracyScore: 94,
    fluencyScore: 91,
    integrityScore: 96,
    standardScore: 93,
    totalScore: 94,
    wordCount: 7,
  });
});

test("invalid Base64, malformed XML, missing fields, and rejected results are provider failures", () => {
  assert.throws(() => decodeXunfeiFinalXml("not base64?", "sid"), XunfeiProviderError);
  assert.throws(() => parseXunfeiEvaluationXml("<xml_result>", "sid"), XunfeiProviderError);
  assert.throws(
    () => parseXunfeiEvaluationXml('<rec_paper accuracy_score="1" fluency_score="2" />', "sid"),
    XunfeiProviderError,
  );
  assert.throws(
    () => parseXunfeiEvaluationXml('<rec_paper except_info="rejected" />', "sid"),
    XunfeiProviderError,
  );
});

test("timeout and early close cancel streaming and reject without a final result", async () => {
  const timeoutSocket = new FakeWebSocket();
  await assert.rejects(
    createClient(timeoutSocket, { ...CONFIG, requestTimeoutMs: 5 }).evaluate({
      audio: INPUT.audio!.normalized.data,
      referenceText: INPUT.referenceText!,
    }),
    XunfeiProviderError,
  );
  assert.deepEqual(timeoutSocket.closeCalls, [1000]);

  const closeSocket = new FakeWebSocket();
  const pending = createClient(closeSocket).evaluate({ audio: INPUT.audio!.normalized.data, referenceText: INPUT.referenceText! });
  closeSocket.open();
  closeSocket.closed();
  await assert.rejects(pending, XunfeiProviderError);
});

test("an abort signal stops the Xunfei stream and closes its WebSocket", async () => {
  const socket = new FakeWebSocket();
  const controller = new AbortController();
  const pending = createClient(socket).evaluate({
    audio: INPUT.audio!.normalized.data,
    referenceText: INPUT.referenceText!,
    signal: controller.signal,
  });
  socket.open();
  controller.abort();
  await assert.rejects(pending, XunfeiProviderError);
  const sentAtAbort = socket.sent.length;
  await delay(5);
  assert.equal(socket.sent.length, sentAtAbort);
  assert.deepEqual(socket.closeCalls, [1000]);
});

test("missing credentials and Xunfei transport failures fall back to classroom-safe mock feedback", async () => {
  const unavailable = new XunfeiAnalyzer({
    iseUrl: CONFIG.iseUrl,
    requestTimeoutMs: CONFIG.requestTimeoutMs,
    frameBytes: CONFIG.frameBytes,
    frameIntervalMs: CONFIG.frameIntervalMs,
  });
  const service = new SpeechAnalysisService({
    mode: "xunfei",
    mockAnalyzer: new MockAnalyzer(),
    xunfeiAnalyzer: unavailable,
  });
  const result = await service.analyze(INPUT);
  assert.ok([3.5, 4, 4.5, 5].includes(result.rhythm));
  assert.equal("provider" in result, false);
  assert.equal("error" in result, false);
});

test("the server-only analyzer calibrates Xunfei scores into the unchanged unified feedback contract", async () => {
  const socket = new FakeWebSocket();
  const analyzer = new XunfeiAnalyzer(CONFIG, () => socket);
  const pending = analyzer.analyze(INPUT);
  socket.open();
  socket.message({ sid: "sid-feedback", code: 0, data: { status: 2, data: Buffer.from(VALID_XML).toString("base64") } });
  const result = await pending;
  assert.deepEqual(Object.keys(result).sort(), ["clarity", "comments", "fluency", "praise", "rhythm"]);
  assert.ok([3.5, 4, 4.5, 5].includes(result.rhythm));
  assert.ok([3.5, 4, 4.5, 5].includes(result.fluency));
  assert.ok([3.5, 4, 4.5, 5].includes(result.clarity));
});
