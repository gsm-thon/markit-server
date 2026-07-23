import { env } from "../config/env";
import { ApiException } from "../utils/apiException";
import type { RawFinding } from "./regexDetectors";
import type { ScanMode } from "../types/scan.types";

const CATEGORY_GUIDE: Record<ScanMode, string> = {
  privacy: `- name: 이름 (다른 개인정보와 결합되어 식별 가능한 경우)
- address: 주소, 거주지 정보
- birth_date: 생년월일
- family_member: 가족 구성원의 실명이 언급된 경우`,
  blind_hiring: `- school_name: 학교명 (출신 학교를 알 수 있는 표현 포함)
- family_background: 가족관계, 부모 직업 등 가정 배경
- age: 나이, 생년, 출생년도로 나이를 유추할 수 있는 표현
- appearance: 외모, 신체 조건에 대한 언급
- hometown: 출신 지역
- gender_marital: 성별, 결혼/혼인 여부`,
};

interface GroqRawItem {
  type: string;
  label: string;
  matchedText: string;
  reason: string;
  severity: "low" | "medium" | "high";
  action: "mask" | "replace" | "delete" | "review";
  suggestion: string | null;
}

function buildPrompt(text: string, mode: ScanMode): string {
  return `당신은 한국어 문서에서 민감 정보를 탐지하는 도우미입니다.
아래 "탐지 카테고리"에 해당하는 문구를 문서에서 찾아 JSON으로만 응답하세요.

탐지 카테고리 (${mode} 모드):
${CATEGORY_GUIDE[mode]}

응답은 반드시 다음 형태의 JSON 객체 하나로만 반환하세요:
{"findings": [ { "type": "...", "label": "...", "matchedText": "...", "reason": "...", "severity": "low|medium|high", "action": "mask|replace|delete|review", "suggestion": "..." | null } ]}

- matchedText는 문서에서 그대로 발췌한 원문이어야 하며, 반드시 원문에 실제로 존재하는 부분 문자열이어야 합니다.
- 해당 사항이 없으면 {"findings": []} 를 반환하세요.

문서:
"""
${text}
"""`;
}

export async function detectWithGroq(text: string, mode: ScanMode): Promise<RawFinding[]> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.groqApiKey}`,
    },
    body: JSON.stringify({
      model: env.groqModel,
      messages: [{ role: "user", content: buildPrompt(text, mode) }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new ApiException(500, "ANALYSIS_FAILED", `Groq 호출 실패: ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawText = payload.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new ApiException(500, "ANALYSIS_FAILED", "Groq 응답을 파싱할 수 없습니다.");
  }

  let parsed: { findings?: GroqRawItem[] };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new ApiException(500, "ANALYSIS_FAILED", "Groq 응답이 올바른 JSON이 아닙니다.");
  }

  const findings: RawFinding[] = [];
  for (const item of parsed.findings ?? []) {
    const startOffset = text.indexOf(item.matchedText);
    if (startOffset === -1) continue; // 모델이 원문에 없는 텍스트를 반환한 경우 offset 계산 불가 -> 스킵

    findings.push({
      type: item.type,
      label: item.label,
      originalText: item.matchedText,
      reason: item.reason,
      severity: item.severity,
      action: item.action,
      suggestion: item.suggestion ?? null,
      startOffset,
      endOffset: startOffset + item.matchedText.length,
    });
  }

  return findings;
}
