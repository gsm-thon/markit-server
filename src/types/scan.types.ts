export type ScanMode = "privacy" | "blind_hiring";

export type FindingSeverity = "low" | "medium" | "high";

export type FindingAction = "mask" | "replace" | "delete" | "review";

export interface Finding {
  findingId: string;
  type: string;
  label: string;
  originalText: string;
  reason: string;
  severity: FindingSeverity;
  action: FindingAction;
  suggestion: string | null;
  page: number;
  startOffset: number;
  endOffset: number;
  resolved: boolean;
  replacementText: string | null;
}

export interface ScanSummary {
  needsFix: number;
  autoMasked: number;
  passed: number;
}

export interface ScanSession {
  scanId: string;
  fileName: string;
  mode: ScanMode;
  createdAt: string;
  expiresAt: string;
  extractedText: string;
  findings: Finding[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
