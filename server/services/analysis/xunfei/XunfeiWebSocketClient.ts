import WebSocket from "ws";

import { createAuthenticatedXunfeiUrl } from "./XunfeiAuth.js";
import { decodeXunfeiFinalXml } from "./XunfeiResultParser.js";
import {
  XunfeiProviderError,
} from "./XunfeiTypes.js";
import type {
  ResolvedXunfeiProviderConfig,
  XunfeiEvaluationRequest,
  XunfeiFinalResponse,
  XunfeiWebSocketFactory,
} from "./XunfeiTypes.js";

const MAX_FRAME_BYTES = 19_200;

interface XunfeiResponse {
  code?: unknown;
  message?: unknown;
  sid?: unknown;
  data?: {
    status?: unknown;
    data?: unknown;
  };
}

function toText(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return data instanceof ArrayBuffer
    ? Buffer.from(new Uint8Array(data)).toString("utf8")
    : data.toString("utf8");
}

function responseFrom(data: Buffer | ArrayBuffer | Buffer[]): XunfeiResponse {
  try {
    return JSON.parse(toText(data)) as XunfeiResponse;
  } catch {
    throw new XunfeiProviderError("Xunfei returned malformed JSON.");
  }
}

function xunfeiMessage(response: XunfeiResponse): string | undefined {
  return typeof response.message === "string" && response.message.trim()
    ? response.message.trim()
    : undefined;
}

export class XunfeiWebSocketClient {
  constructor(
    private readonly config: ResolvedXunfeiProviderConfig,
    private readonly socketFactory: XunfeiWebSocketFactory = (url) => new WebSocket(url),
  ) {}

  evaluate(request: XunfeiEvaluationRequest): Promise<XunfeiFinalResponse> {
    if (request.audio.byteLength === 0) {
      return Promise.reject(new XunfeiProviderError("Normalized PCM audio is empty."));
    }

    const frameBytes = Math.min(this.config.frameBytes, MAX_FRAME_BYTES);
    const authenticatedUrl = createAuthenticatedXunfeiUrl(this.config);
    const socket = this.socketFactory(authenticatedUrl);

    return new Promise<XunfeiFinalResponse>((resolve, reject) => {
      let offset = 0;
      let timer: NodeJS.Timeout | undefined;
      let timeout: NodeJS.Timeout | undefined;
      let settled = false;
      let finalResultReceived = false;
      let sid: string | undefined;
      let webSocketConnected = false;
      let audioFramesSent = 0;
      let audioStreamingStartedAt: number | undefined;
      let audioStreamingFinishedAt: number | undefined;

      const reportMetrics = () => {
        request.onMetrics?.({
          webSocketConnected,
          audioFramesSent,
          audioSendDurationMs:
            audioStreamingStartedAt !== undefined &&
            audioStreamingFinishedAt !== undefined
              ? audioStreamingFinishedAt - audioStreamingStartedAt
              : undefined,
        });
      };

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
        request.signal?.removeEventListener("abort", cancel);
      };
      const close = () => {
        try {
          socket.close(1000);
        } catch {
          // The provider transport is already terminating.
        }
      };
      const fail = (error: XunfeiProviderError) => {
        if (settled) return;
        settled = true;
        cleanup();
        reportMetrics();
        close();
        reject(error);
      };
      const succeed = (result: XunfeiFinalResponse) => {
        if (settled) return;
        settled = true;
        finalResultReceived = true;
        cleanup();
        reportMetrics();
        close();
        resolve(result);
      };
      const cancel = () => fail(new XunfeiProviderError("Xunfei evaluation was cancelled.", { sid }));
      timeout = setTimeout(
        () => fail(new XunfeiProviderError("Xunfei evaluation timed out.", { sid })),
        this.config.requestTimeoutMs,
      );

      const send = (frame: Record<string, unknown>) => socket.send(JSON.stringify(frame));
      const sendFinalFrame = () => {
        audioStreamingFinishedAt = Date.now();
        send({
          business: { cmd: "auw", aus: 4, aue: "raw" },
          data: { status: 2, data: "", data_type: 1, encoding: "raw" },
        });
      };
      const sendNextFrame = () => {
        if (settled) return;
        if (offset >= request.audio.byteLength) {
          sendFinalFrame();
          return;
        }
        const end = Math.min(offset + frameBytes, request.audio.byteLength);
        const audioFrame = request.audio.slice(offset, end);
        const isFirst = offset === 0;
        audioStreamingStartedAt ??= Date.now();
        audioFramesSent += 1;
        offset = end;
        send({
          business: { cmd: "auw", aus: isFirst ? 1 : 2, aue: "raw" },
          data: {
            status: 1,
            data: Buffer.from(audioFrame).toString("base64"),
            data_type: 1,
            encoding: "raw",
          },
        });
        timer = setTimeout(sendNextFrame, this.config.frameIntervalMs);
      };

      socket.on("open", () => {
        try {
          webSocketConnected = true;
          send({
            common: { app_id: this.config.appId },
            business: {
              sub: "ise",
              ent: "en_vip",
              category: "read_chapter",
              cmd: "ssb",
              text: `\uFEFF[content]\n${request.referenceText}`,
              tte: "utf-8",
              ttp_skip: true,
              aue: "raw",
              auf: "audio/L16;rate=16000",
              rstcd: "utf8",
              rst: "entirety",
              ise_unite: "1",
              extra_ability: "multi_dimension",
            },
            data: { status: 0, data: "" },
          });
          sendNextFrame();
        } catch (error) {
          fail(new XunfeiProviderError("Xunfei audio streaming failed.", { sid }));
        }
      });
      socket.on("message", (data) => {
        try {
          const response = responseFrom(data);
          sid = typeof response.sid === "string" ? response.sid : sid;
          const code = typeof response.code === "number" ? response.code : Number(response.code);
          if (!Number.isFinite(code)) {
            fail(new XunfeiProviderError("Xunfei response did not include a valid code.", { sid }));
            return;
          }
          if (code !== 0) {
            fail(
              new XunfeiProviderError("Xunfei returned an evaluation error.", {
                code,
                sid,
                providerMessage: xunfeiMessage(response),
              }),
            );
            return;
          }
          if (response.data?.status === 2) {
            const xml = decodeXunfeiFinalXml(response.data.data, sid ?? "unknown");
            succeed({ sid: sid ?? "unknown", xml });
          }
        } catch (error) {
          fail(error instanceof XunfeiProviderError ? error : new XunfeiProviderError("Xunfei response processing failed.", { sid }));
        }
      });
      socket.on("error", () => fail(new XunfeiProviderError("Xunfei connection failed.", { sid })));
      socket.on("close", () => {
        if (!settled && !finalResultReceived) {
          fail(new XunfeiProviderError("Xunfei connection closed before a final result.", { sid }));
        }
      });
      request.signal?.addEventListener("abort", cancel, { once: true });
    });
  }
}
