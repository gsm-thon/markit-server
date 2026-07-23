export interface RawFinding {
  type: string;
  label: string;
  originalText: string;
  reason: string;
  severity: "low" | "medium" | "high";
  action: "mask" | "replace" | "delete" | "review";
  suggestion: string | null;
  startOffset: number;
  endOffset: number;
}

interface Pattern {
  type: string;
  label: string;
  reason: string;
  severity: "low" | "medium" | "high";
  action: "mask" | "replace" | "delete" | "review";
  regex: RegExp;
}

const PATTERNS: Pattern[] = [
  {
    type: "phone",
    label: "전화번호",
    reason: "휴대전화 또는 유선전화 번호는 개인 식별 정보입니다.",
    severity: "high",
    action: "mask",
    regex: /\b0\d{1,2}-?\d{3,4}-?\d{4}\b/g,
  },
  {
    type: "email",
    label: "이메일",
    reason: "이메일 주소는 개인 식별 정보입니다.",
    severity: "high",
    action: "mask",
    regex: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g,
  },
  {
    type: "resident_number",
    label: "주민등록번호",
    reason: "주민등록번호 형식의 문자열이 발견되었습니다.",
    severity: "high",
    action: "delete",
    regex: /\b\d{6}-?[1-4]\d{6}\b/g,
  },
  {
    type: "student_id",
    label: "학번",
    reason: "학번은 소속 및 입학년도를 유추할 수 있는 정보입니다.",
    severity: "medium",
    action: "mask",
    regex: /\b(?:20\d{2}|19\d{2})\d{4,6}\b/g,
  },
];

export function runRegexDetectors(text: string): RawFinding[] {
  const findings: RawFinding[] = [];

  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern.regex)) {
      if (match.index === undefined) continue;
      findings.push({
        type: pattern.type,
        label: pattern.label,
        originalText: match[0],
        reason: pattern.reason,
        severity: pattern.severity,
        action: pattern.action,
        suggestion: null,
        startOffset: match.index,
        endOffset: match.index + match[0].length,
      });
    }
  }

  return findings;
}
