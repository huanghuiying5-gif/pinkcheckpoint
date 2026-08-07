import type { AnalysisMode } from "../src/services/analysis/types.js";

export interface ServerConfig {
  port: number;
  databasePath: string;
  teacherPassword: string;
  sessionSecret: string;
  sessionTtlMs: number;
  secureCookie: boolean;
  aiMode: AnalysisMode;
}

function required(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

export function loadServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const sessionSecret = required(environment, "SESSION_SECRET");
  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return {
    port: Number(environment.PORT ?? 3001),
    databasePath:
      environment.DATABASE_PATH?.trim() || "./data/speak-with-rhythm.sqlite",
    teacherPassword: required(environment, "TEACHER_SETUP_PASSWORD"),
    sessionSecret,
    sessionTtlMs: 8 * 60 * 60 * 1_000,
    secureCookie: environment.NODE_ENV === "production",
    aiMode:
      environment.AI_MODE?.trim().toLowerCase() === "xunfei"
        ? "xunfei"
        : "mock",
  };
}
