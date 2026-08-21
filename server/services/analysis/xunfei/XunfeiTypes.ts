import type { SupportedStarRating } from "../../../../src/services/analysis/types.js";

export interface XunfeiProviderConfig {
  appId?: string;
  apiKey?: string;
  apiSecret?: string;
  iseUrl: string;
  requestTimeoutMs: number;
  frameBytes: number;
  frameIntervalMs: number;
}

export interface ResolvedXunfeiProviderConfig {
  appId: string;
  apiKey: string;
  apiSecret: string;
  iseUrl: string;
  requestTimeoutMs: number;
  frameBytes: number;
  frameIntervalMs: number;
}

export interface XunfeiRawResult {
  sid: string;
  accuracyScore: number;
  fluencyScore: number;
  integrityScore: number;
  standardScore: number;
  totalScore?: number;
  wordCount?: number;
  isRejected?: boolean;
  exceptInfo?: string;
}

export interface XunfeiEvaluationRequest {
  audio: Uint8Array;
  referenceText: string;
  signal?: AbortSignal;
  onMetrics?: (metrics: XunfeiStreamingMetrics) => void;
}

/** Safe transport measurements for the explicit development-only live test. */
export interface XunfeiStreamingMetrics {
  webSocketConnected: boolean;
  audioFramesSent: number;
  audioSendDurationMs?: number;
}

export interface XunfeiFinalResponse {
  sid: string;
  xml: string;
}

export interface XunfeiWebSocket {
  send(data: string): void;
  close(code?: number): void;
  on(event: "open", listener: () => void): this;
  on(event: "message", listener: (data: Buffer | ArrayBuffer | Buffer[]) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: (code: number) => void): this;
}

export type XunfeiWebSocketFactory = (url: string) => XunfeiWebSocket;

export class XunfeiProviderError extends Error {
  readonly providerCode?: number;
  readonly sid?: string;
  /** Provider diagnostic text is retained only in memory and never logged or sent to clients. */
  readonly providerMessage?: string;

  constructor(
    message: string,
    options: { code?: number; sid?: string; providerMessage?: string } = {},
  ) {
    super(message);
    this.name = "XunfeiProviderError";
    this.providerCode = options.code;
    this.sid = options.sid;
    this.providerMessage = options.providerMessage;
  }
}

export class XunfeiProviderUnavailableError extends XunfeiProviderError {
  constructor() {
    super("Xunfei speech evaluation is not configured.");
    this.name = "XunfeiProviderUnavailableError";
  }
}

export type XunfeiCalibratedFeedback = {
  rhythm: SupportedStarRating;
  fluency: SupportedStarRating;
  clarity: SupportedStarRating;
};
