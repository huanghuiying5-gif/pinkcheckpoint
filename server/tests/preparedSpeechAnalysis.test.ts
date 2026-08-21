import assert from "node:assert/strict";
import test from "node:test";

import {
  SpeechAnalysisApiClient,
} from "../../src/services/analysis/SpeechAnalysisApiClient.js";
import type {
  AnalyzeRecordingInput,
} from "../../src/services/analysis/SpeechAnalysisApiClient.js";
import { scheduleReflectionDeadline } from "../../src/features/ai-reflection/useReflectionTransition.js";
import type { ReflectionDeadlineTimer } from "../../src/features/ai-reflection/useReflectionTransition.js";
import type { SpeechFeedbackResult } from "../../src/services/analysis/types.js";

const INPUT: AnalyzeRecordingInput = {
  recording: {
    attemptId: "prepared-attempt",
    volumeStability: 0.72,
    volumeVariation: 0.5,
    recordingQuality: 0.84,
    voicePresence: 0.9,
    durationSeconds: 20,
    signature: 42_424,
  },
  audio: new Blob(["recording"], { type: "audio/webm" }),
  referenceText: "Read this classroom passage aloud.",
  passageRevision: 3,
};

const PROVIDER_RESULT: SpeechFeedbackResult = {
  rhythm: 5,
  fluency: 4.5,
  clarity: 5,
  praise: "Excellent!",
  comments: {
    rhythm: "Your rhythm feels natural and expressive.",
    fluency: "Your speech flows smoothly and confidently.",
    clarity: "Your message is easy to understand.",
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function responseFor(result: SpeechFeedbackResult): Response {
  return {
    ok: true,
    json: async () => result,
  } as Response;
}

test("prepared analysis starts one background upload with a deterministic fallback", async () => {
  const provider = deferred<Response>();
  let calls = 0;
  const client = new SpeechAnalysisApiClient({
    fetchImplementation: async () => {
      calls += 1;
      return provider.promise;
    },
  });

  const prepared = client.prepareAnalysis(INPUT);
  const sameFallback = client.prepareAnalysis({ ...INPUT, recording: INPUT.recording });

  assert.equal(calls, 1);
  assert.equal(prepared, sameFallback);
  assert.deepEqual(prepared.fallbackResult, sameFallback.fallbackResult);
  provider.resolve(responseFor(PROVIDER_RESULT));
  await prepared.providerResultPromise;
});

test("a prepared result ready before the deadline is selected without another upload", async () => {
  let calls = 0;
  const client = new SpeechAnalysisApiClient({
    fetchImplementation: async () => {
      calls += 1;
      return responseFor(PROVIDER_RESULT);
    },
  });
  const prepared = client.prepareAnalysis(INPUT);
  await prepared.providerResultPromise;

  assert.deepEqual(
    client.resolvePreparedAnalysis(prepared.sessionId),
    PROVIDER_RESULT,
  );
  assert.equal(calls, 1);
  assert.deepEqual(client.getLatestResult(), PROVIDER_RESULT);
});

test("a pending or rejected provider result selects the original deterministic fallback", async () => {
  const pendingProvider = deferred<Response>();
  const client = new SpeechAnalysisApiClient({
    fetchImplementation: async () => pendingProvider.promise,
  });
  const prepared = client.prepareAnalysis(INPUT);
  const fallback = prepared.fallbackResult;

  assert.deepEqual(client.resolvePreparedAnalysis(prepared.sessionId), fallback);
  pendingProvider.resolve(responseFor(PROVIDER_RESULT));
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(client.getLatestResult(), fallback);
});

test("a rejected prepared request never breaks the deterministic Mock fallback", async () => {
  const client = new SpeechAnalysisApiClient({
    fetchImplementation: async () => {
      throw new Error("network unavailable");
    },
  });
  const prepared = client.prepareAnalysis(INPUT);
  await assert.rejects(prepared.providerResultPromise);
  assert.deepEqual(
    client.resolvePreparedAnalysis(prepared.sessionId),
    prepared.fallbackResult,
  );
});

test("a new recording cancels the old upload and cannot apply its result", async () => {
  const firstProvider = deferred<Response>();
  let firstSignal: AbortSignal | undefined;
  let calls = 0;
  const client = new SpeechAnalysisApiClient({
    fetchImplementation: async (_url, options) => {
      calls += 1;
      if (calls === 1) {
        firstSignal = options?.signal ?? undefined;
        return firstProvider.promise;
      }
      return responseFor(PROVIDER_RESULT);
    },
  });
  const first = client.prepareAnalysis(INPUT);
  const second = client.prepareAnalysis({
    ...INPUT,
    recording: { ...INPUT.recording, attemptId: "newer-attempt" },
  });

  assert.equal(firstSignal?.aborted, true);
  firstProvider.resolve(responseFor(PROVIDER_RESULT));
  await Promise.resolve();
  assert.notDeepEqual(client.resolvePreparedAnalysis(first.sessionId), PROVIDER_RESULT);
  await second.providerResultPromise;
  assert.deepEqual(client.resolvePreparedAnalysis(second.sessionId), PROVIDER_RESULT);
});

test("the reflection scheduler completes once at exactly 3000ms with fake time", () => {
  let now = 0;
  let callback: (() => void) | undefined;
  let scheduledDelay = 0;
  let completed = 0;
  const timer: ReflectionDeadlineTimer = {
    now: () => now,
    setTimeout: (next, delayMs) => {
      callback = next;
      scheduledDelay = delayMs;
      return 1;
    },
    clearTimeout: () => {
      callback = undefined;
    },
  };

  const cancel = scheduleReflectionDeadline(() => {
    completed += 1;
  }, timer);
  assert.equal(scheduledDelay, 3_000);
  now = 2_999;
  callback?.();
  assert.equal(completed, 0);
  assert.equal(scheduledDelay, 1);
  now = 3_000;
  callback?.();
  assert.equal(completed, 1);
  cancel();
  assert.equal(completed, 1);
});
