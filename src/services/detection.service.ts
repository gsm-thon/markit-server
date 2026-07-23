import { randomUUID } from "node:crypto";
import { runRegexDetectors } from "./regexDetectors";
import { detectWithGroq } from "./groqDetector";
import type { Finding, ScanMode, ScanSummary } from "../types/scan.types";

function overlaps(a: { startOffset: number; endOffset: number }, b: { startOffset: number; endOffset: number }) {
  return a.startOffset < b.endOffset && b.startOffset < a.endOffset;
}

export async function analyzeText(text: string, mode: ScanMode): Promise<{ findings: Finding[]; summary: ScanSummary }> {
  const [regexFindings, llmFindings] = await Promise.all([
    Promise.resolve(runRegexDetectors(text)),
    detectWithGroq(text, mode),
  ]);

  const merged = [...regexFindings];
  for (const candidate of llmFindings) {
    const hasOverlap = merged.some((existing) => overlaps(existing, candidate));
    if (!hasOverlap) merged.push(candidate);
  }

  merged.sort((a, b) => a.startOffset - b.startOffset);

  const findings: Finding[] = merged.map((raw) => ({
    findingId: `finding_${randomUUID()}`,
    type: raw.type,
    label: raw.label,
    originalText: raw.originalText,
    reason: raw.reason,
    severity: raw.severity,
    action: raw.action,
    suggestion: raw.suggestion,
    page: 1,
    startOffset: raw.startOffset,
    endOffset: raw.endOffset,
    resolved: false,
    replacementText: null,
  }));

  const summary: ScanSummary = {
    needsFix: findings.filter((f) => f.action === "review").length,
    autoMasked: findings.filter((f) => f.action === "mask" || f.action === "delete").length,
    passed: findings.filter((f) => f.action === "replace").length,
  };

  return { findings, summary };
}
