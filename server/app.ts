import express from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { resolve } from "node:path";

import {
  SESSION_COOKIE_NAME,
  createTeacherSession,
  isValidTeacherSession,
  passwordMatches,
  readCookie,
  teacherCookieOptions,
} from "./auth/teacherAuth.js";
import type { TeacherAuthConfig } from "./auth/teacherAuth.js";
import { LoginRateLimiter } from "./auth/loginRateLimiter.js";
import type { ReadingPassageStore } from "./database/ReadingPassageStore.js";
import {
  parseMultipartSpeechAnalysisInput,
  parseSpeechAnalysisInput,
} from "./services/analysisRequest.js";
import { AudioNormalizationService } from "./services/audio/AudioNormalizationService.js";
import type { AudioNormalizer } from "./services/audio/AudioNormalizationService.js";
import type { SpeechAnalysisService } from "../src/services/analysis/speechAnalysisService.js";

interface CreateAppOptions {
  store: ReadingPassageStore;
  auth: TeacherAuthConfig;
  speechAnalysis: SpeechAnalysisService;
  frontendDistPath?: string;
  audioNormalizer?: AudioNormalizer;
  audioUploadMaxBytes?: number;
}

const MAX_PASSAGE_CHARACTERS = 5_000;
const DEFAULT_AUDIO_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

class UnsupportedBrowserAudioError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported browser recording MIME type: ${mimeType || "missing"}.`);
    this.name = "UnsupportedBrowserAudioError";
  }
}

function isSupportedBrowserAudioMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return (
    normalized === "audio/webm" ||
    normalized.startsWith("audio/webm;") ||
    normalized === "audio/mp4" ||
    normalized.startsWith("audio/mp4;")
  );
}

function uploadFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return "Unknown upload failure";
}

function logAudioFallback(reason: string): void {
  console.warn("Speech audio preparation failed; using mock-capable analysis.", {
    reason,
  });
}

function createSpeechAudioUpload(maxBytes: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 1,
      fields: 4,
      parts: 5,
      fileSize: maxBytes,
      fieldNameSize: 64,
      fieldSize: 24 * 1024,
    },
    fileFilter: (_request, file, callback) => {
      if (isSupportedBrowserAudioMimeType(file.mimetype)) {
        callback(null, true);
        return;
      }
      callback(new UnsupportedBrowserAudioError(file.mimetype));
    },
  });
}

export function createApp({
  store,
  auth,
  speechAnalysis,
  frontendDistPath,
  audioNormalizer = new AudioNormalizationService({
    ffmpegPath: "ffmpeg",
    timeoutMs: 15_000,
  }),
  audioUploadMaxBytes = DEFAULT_AUDIO_UPLOAD_MAX_BYTES,
}: CreateAppOptions) {
  const app = express();
  const loginLimiter = new LoginRateLimiter({
    maxFailures: 5,
    windowMs: 10 * 60 * 1_000,
    blockMs: 15 * 60 * 1_000,
  });

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "32kb" }));
  const speechAudioUpload = createSpeechAudioUpload(audioUploadMaxBytes);

  const hasTeacherSession = (request: Request) =>
    isValidTeacherSession(
      readCookie(request.headers.cookie, SESSION_COOKIE_NAME),
      auth,
    );

  const requireTeacherSession = (
    request: Request,
    response: Response,
    next: NextFunction,
  ) => {
    if (!hasTeacherSession(request)) {
      response.status(401).json({ error: "Teacher authentication is required." });
      return;
    }
    next();
  };

  app.get("/api/reading-passage", (_request, response) => {
    response.json(store.getCurrent());
  });

  app.post("/api/speech-analysis", (request, response, next) => {
    speechAudioUpload.single("audio")(request, response, (uploadError) => {
      void (async () => {
        let input = parseSpeechAnalysisInput(request.body);
        let fieldsAreValid = true;
        const analysisAbortController = new AbortController();
        request.once("aborted", () => analysisAbortController.abort());

        try {
          input = parseMultipartSpeechAnalysisInput(request.body);
        } catch (error) {
          fieldsAreValid = false;
          logAudioFallback(uploadFailureReason(error));
        }

        if (uploadError) {
          logAudioFallback(uploadFailureReason(uploadError));
        } else if (!request.file) {
          logAudioFallback("No audio file was included in the analysis request.");
        } else if (fieldsAreValid) {
          try {
            const normalized = await audioNormalizer.normalize({
              data: request.file.buffer,
              mimeType: request.file.mimetype,
            });
            input = {
              ...input,
              audio: {
                original: {
                  mimeType: request.file.mimetype,
                  byteLength: request.file.size,
                },
                normalized,
              },
            };
            console.info("Speech audio normalized for analysis.", {
              format: normalized.format,
              sampleRate: normalized.sampleRate,
              channels: normalized.channels,
              bitDepth: normalized.bitDepth,
              durationMs: normalized.durationMs,
            });
          } catch (error) {
            logAudioFallback(uploadFailureReason(error));
          }
        }

        try {
          response.json(
            await speechAnalysis.analyze({
              ...input,
              signal: analysisAbortController.signal,
            }),
          );
        } catch (error) {
          next(error);
        }
      })();
    });
  });

  app.post("/api/setup/login", (request, response) => {
    const rateLimitKey = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const retryAfterSeconds = loginLimiter.getRetryAfterSeconds(rateLimitKey);

    if (retryAfterSeconds > 0) {
      response.setHeader("Retry-After", retryAfterSeconds);
      response.status(429).json({
        error: "Too many login attempts. Please wait before trying again.",
      });
      return;
    }

    const password = request.body?.password;
    if (typeof password !== "string") {
      response.status(400).json({ error: "A password is required." });
      return;
    }

    if (!passwordMatches(password, auth.password)) {
      loginLimiter.registerFailure(rateLimitKey);
      response.status(401).json({ error: "The password is incorrect." });
      return;
    }

    loginLimiter.clear(rateLimitKey);
    response.cookie(
      SESSION_COOKIE_NAME,
      createTeacherSession(auth),
      teacherCookieOptions(auth),
    );
    response.json({ authenticated: true });
  });

  app.post("/api/setup/logout", (_request, response) => {
    response.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: auth.secureCookie,
      path: "/",
    });
    response.json({ authenticated: false });
  });

  app.get("/api/setup/session", (request, response) => {
    response.json({ authenticated: hasTeacherSession(request) });
  });

  app.put(
    "/api/reading-passage",
    requireTeacherSession,
    (request, response) => {
      if (typeof request.body?.content !== "string") {
        response.status(400).json({ error: "Passage content is required." });
        return;
      }

      const content = request.body.content.trim();
      if (!content) {
        response.status(400).json({ error: "Passage content cannot be empty." });
        return;
      }
      if (content.length > MAX_PASSAGE_CHARACTERS) {
        response.status(400).json({
          error: `Passage content cannot exceed ${MAX_PASSAGE_CHARACTERS} characters.`,
        });
        return;
      }

      response.json(store.replaceCurrent(content));
    },
  );

  app.use("/api", (_request, response) => {
    response.status(404).json({ error: "API endpoint not found." });
  });

  if (frontendDistPath) {
    const absoluteFrontendPath = resolve(frontendDistPath);
    app.use(express.static(absoluteFrontendPath));
    app.use((request, response, next) => {
      if (request.method !== "GET") {
        next();
        return;
      }
      response.sendFile(resolve(absoluteFrontendPath, "index.html"));
    });
  }

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      _next: NextFunction,
    ) => {
      console.error(error);
      response.status(500).json({ error: "An unexpected server error occurred." });
    },
  );

  return app;
}
