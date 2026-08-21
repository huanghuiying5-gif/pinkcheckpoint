import { createHmac } from "node:crypto";

import type { ResolvedXunfeiProviderConfig } from "./XunfeiTypes.js";

export function createAuthenticatedXunfeiUrl(
  config: Pick<ResolvedXunfeiProviderConfig, "apiKey" | "apiSecret" | "iseUrl">,
  now = new Date(),
): string {
  const endpoint = new URL(config.iseUrl);
  const host = endpoint.host;
  const date = now.toUTCString();
  const requestLine = `GET ${endpoint.pathname || "/"} HTTP/1.1`;
  const signatureSource = `host: ${host}\ndate: ${date}\n${requestLine}`;
  const signature = createHmac("sha256", config.apiSecret)
    .update(signatureSource, "utf8")
    .digest("base64");
  const authorizationOrigin = [
    `api_key=\"${config.apiKey}\"`,
    'algorithm="hmac-sha256"',
    'headers="host date request-line"',
    `signature=\"${signature}\"`,
  ].join(", ");

  endpoint.searchParams.set(
    "authorization",
    Buffer.from(authorizationOrigin, "utf8").toString("base64"),
  );
  endpoint.searchParams.set("date", date);
  endpoint.searchParams.set("host", host);
  return endpoint.toString();
}
