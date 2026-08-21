import { XMLParser, XMLValidator } from "fast-xml-parser";

import { XunfeiProviderError } from "./XunfeiTypes.js";
import type { XunfeiRawResult } from "./XunfeiTypes.js";

const REQUIRED_SCORE_KEYS = [
  "accuracy_score",
  "fluency_score",
  "integrity_score",
  "standard_score",
] as const;

function readScalar(node: Record<string, unknown>, key: string): unknown {
  return node[`@_${key}`] ?? node[key];
}

function numberField(node: Record<string, unknown>, key: string): number | undefined {
  const value = readScalar(node, key);
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function stringField(node: Record<string, unknown>, key: string): string | undefined {
  const value = readScalar(node, key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function collectCandidates(value: unknown, candidates: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCandidates(item, candidates));
    return candidates;
  }

  if (value !== null && typeof value === "object") {
    const node = value as Record<string, unknown>;
    candidates.push(node);
    Object.values(node).forEach((item) => collectCandidates(item, candidates));
  }
  return candidates;
}

function hasRequiredScores(node: Record<string, unknown>): boolean {
  return REQUIRED_SCORE_KEYS.every((key) => numberField(node, key) !== undefined);
}

function hasRejectedEvaluation(node: Record<string, unknown>): boolean {
  const rejected = readScalar(node, "is_rejected");
  const exception = stringField(node, "except_info");
  return rejected === true || rejected === "true" || rejected === "1" || Boolean(exception);
}

/** Parses only the chapter-level score fields; raw XML is never returned or retained. */
export function parseXunfeiEvaluationXml(xml: string, sid: string): XunfeiRawResult {
  if (!xml.trim()) {
    throw new XunfeiProviderError("Xunfei returned an empty evaluation result.", { sid });
  }
  if (XMLValidator.validate(xml) !== true) {
    throw new XunfeiProviderError("Xunfei returned malformed evaluation XML.", { sid });
  }

  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    trimValues: true,
  }).parse(xml) as Record<string, unknown>;
  const candidates = collectCandidates(parsed);
  const rejected = candidates.find(hasRejectedEvaluation);
  if (rejected) {
    throw new XunfeiProviderError("Xunfei rejected this evaluation.", { sid });
  }

  const resultNode = candidates.find(hasRequiredScores);
  if (!resultNode) {
    throw new XunfeiProviderError("Xunfei did not return required chapter scores.", { sid });
  }

  const accuracyScore = numberField(resultNode, "accuracy_score");
  const fluencyScore = numberField(resultNode, "fluency_score");
  const integrityScore = numberField(resultNode, "integrity_score");
  const standardScore = numberField(resultNode, "standard_score");
  if (
    accuracyScore === undefined ||
    fluencyScore === undefined ||
    integrityScore === undefined ||
    standardScore === undefined
  ) {
    throw new XunfeiProviderError("Xunfei chapter scores were invalid.", { sid });
  }

  return {
    sid,
    accuracyScore,
    fluencyScore,
    integrityScore,
    standardScore,
    totalScore: numberField(resultNode, "total_score"),
    wordCount: numberField(resultNode, "word_count"),
  };
}

export function decodeXunfeiFinalXml(encoded: unknown, sid: string): string {
  if (typeof encoded !== "string" || !encoded.trim()) {
    throw new XunfeiProviderError("Xunfei returned no final evaluation data.", { sid });
  }
  const compact = encoded.replace(/\s/g, "");
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) {
    throw new XunfeiProviderError("Xunfei returned invalid evaluation data.", { sid });
  }
  const xml = Buffer.from(compact, "base64").toString("utf8");
  if (!xml.trim() || xml.includes("\uFFFD")) {
    throw new XunfeiProviderError("Xunfei returned invalid evaluation XML.", { sid });
  }
  return xml;
}
