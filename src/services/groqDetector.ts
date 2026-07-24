import { env } from "../config/env";
import { ApiException } from "../utils/apiException";
import type { RawFinding } from "./regexDetectors";
import type { ScanMode } from "../types/scan.types";

const PERSONA: Record<ScanMode, string> = {
  privacy: "당신은 개인정보 보호 전문 AI 탐지 엔진입니다. 사용자가 제공한 문서에서 민감한 개인정보를 찾아내어 유출을 방지하는 것이 임무입니다.",
  blind_hiring:
    "당신은 블라인드 채용 심사를 위한 문서 검열 AI입니다. 입사지원서, 자기소개서, 경력기술서에서 블라인드 채용 원칙을 위반하는 표현을 찾아내는 것이 임무입니다.",
};

const CATEGORY_GUIDE: Record<ScanMode, string> = {
  privacy: `- name: 문맥상 실제 사람의 이름으로 판단되는 표현
- address: 도로명주소, 지번주소 등 구체적인 거주지 정보
- birth_date: 출생연도, 생일, 만 나이 등 특정인의 생년월일·연령을 유추할 수 있는 정보
- family_member: 가족 구성원의 실명이 언급된 경우
- affiliation: 특정 개인을 식별할 수 있는 회사명+부서+직급 조합
- vehicle: 차량 번호판 형식 (예: 12가3456)
- account: 계좌번호 (10~14자리 은행 계좌번호 형식)
- passport: 여권번호 (영문 1~2자리 + 숫자 7~8자리)
- license: 운전면허번호 (지역코드 2자리-숫자 6자리-숫자 2자리)
- health: 질병명, 진단 내역, 투약 정보 등 건강/병력 정보
- financial: 카드번호 등 금융정보
- credential: 비밀번호, PIN, OTP 등 인증정보

주의: 전화번호, 이메일, 주민등록번호, 학번은 별도 정규식 필터가 이미 처리하므로 중복 탐지하지 마세요.
공공기관명, 브랜드명, 지명 등 개인 식별과 무관한 고유명사는 탐지하지 마세요.`,
  blind_hiring: `1. name: 성명 기재란 외 본문에 이름이 등장하는 경우 (예: "동아리 살림꾼 '홍길동'")
2. region: 출신지역을 직·간접적으로 유추할 수 있는 표현 (예: "우리나라 수도에서 태어나 쭉 자라왔으며")
3. family: 부모 직업, 형제 정보, 혼인 여부 등 가족관계 (예: "교직생활을 하시는 부모님 아래에서")
4. age: 나이, 생년, 특정 연도 사건과 연결지어 나이를 유추할 수 있는 표현 (예: "88년 올림픽이 개최된 해에 태어나")
5. gender: 성별, 혼인 여부를 유추할 수 있는 표현 (예: "군대 의무 복무 시절", "결혼 후 남편과 함께", "OO여대를 졸업하고", "장남으로서", "형(누나, 언니)에게")
6. school: 학교명(국내외)을 직·간접적으로 유추할 수 있는 표현 — 학교 이메일, 영문 약어, 고유 프로그램명 포함 (예: "서울대총장상을 수상", "SNU 창업동아리", "'SNU 발표와 토론' 수업을 수강", "OO학교 산학협력단")
7. religion: 특정 종교나 종교 활동 언급 (예: "교회 봉사활동을 10년간", "불교 신자로서")
8. politics: 정당, 정치 성향, 정치 활동 언급
9. disability: 장애 관련 언급 (단, 직무 수행에 명백히 필요한 경우는 제외)
10. body_info: 키, 몸무게, 외모 등 신체적 특징 묘사
11. photo: 증명사진 첨부 또는 외모 관련 언급

중요 원칙:
- 위 예시 외에도 직·간접적으로 개인적 사항을 유추할 수 있는 모든 표현이 대상입니다.
- "OO대학 연구소에서"처럼 이미 블라인드 처리된 표현은 위반이 아닙니다.
- 직무 관련 자격증, 업무 경험, 프로젝트 성과 등은 탐지하지 마세요.`,
};

const ACTION_GUIDE: Record<ScanMode, string> = {
  privacy: `- action은 "mask", "replace", "delete", "review" 중 하나를 선택하세요.
- action이 "replace"인 경우에만 suggestion에 실제 대체 문구를 넣으세요. suggestion은 matchedText 자리에 그대로 끼워 넣어도 문장이 자연스럽게 이어지는 실제 대체 문구여야 합니다 (예: "컴퓨터공학 관련 전공"). "~을 삭제하세요" 같은 지시문은 절대 넣지 마세요.
- action이 "mask", "delete", "review"인 경우 suggestion은 반드시 null로 두세요.
- 확신이 낮다고 후보에서 누락하지 말고, 대신 severity를 "low", action을 "review"로 설정해 사람이 검토하도록 하세요.`,
  blind_hiring: `- action은 "replace" 또는 "delete" 중 하나만 사용하세요 ("mask", "review"는 사용하지 마세요).
- 문맥을 해치지 않고 순화된 표현으로 대체 가능한 경우(예: 학교명을 일반 표현으로 순화) action을 "replace"로 설정하고, suggestion에 matchedText 자리에 바로 끼워 넣을 수 있는 실제 대체 문구를 넣으세요 (예: "재학시절 총장상을 수상하였으며", "OO대학 창업동아리").
- 대체가 불가능하거나 문장 자체를 삭제해야 하는 경우 action을 "delete"로 설정하고, suggestion에는 왜 삭제해야 하는지와 어떻게 다시 쓰면 좋을지에 대한 안내 문구를 넣으세요 (이 경우 suggestion은 대체 텍스트가 아니라 사람이 읽는 안내문입니다).
- 확신도가 낮은 항목도 후보에서 누락하지 말고 포함하되, severity만 "low"로 낮추고 action은 그대로 "replace" 또는 "delete" 중 하나를 유지하세요.`,
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
  return `${PERSONA[mode]}
아래 "탐지 대상"에 해당하는 문구를 문서에서 찾아 JSON으로만 응답하세요.

[탐지 대상]
${CATEGORY_GUIDE[mode]}

응답은 반드시 다음 형태의 JSON 객체 하나로만 반환하세요:
{"findings": [ { "type": "...", "label": "...", "matchedText": "...", "reason": "...", "severity": "low|medium|high", "action": "mask|replace|delete|review", "suggestion": "..." | null } ]}

- matchedText는 문서에서 그대로 발췌한 원문이어야 하며, 반드시 원문에 실제로 존재하는 부분 문자열이어야 합니다.
- label은 type을 설명하는 짧은 한글 표시명입니다 (예: "학교명", "생년월일").
- 얼마나 확실한 탐지인지 severity로 표현하세요: 명백한 위반/노출은 "high", 문맥상 유추 가능한 수준은 "medium", 확신이 낮지만 후보로는 알려야 하는 경우는 "low"로 설정하세요.
${ACTION_GUIDE[mode]}
- 해당 사항이 없으면 {"findings": []} 를 반환하세요.

문서:
"""
${text}
"""`;
}

const MAX_RATE_LIMIT_RETRIES = 2;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 4000; // Groq의 Retry-After가 길게 와도 이 값 이상 기다리지 않고 빠르게 429로 응답

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_JSON_VALIDATE_RETRIES = 1; // Groq 서버가 자체 JSON 모드 검증에 실패하는 경우(json_validate_failed) - 샘플링이 달라지면 성공할 수 있어 1회 재시도

async function callGroqWithRetry(prompt: string): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.groqApiKey}`,
      },
      body: JSON.stringify({
        model: env.groqModel,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (response.status === 429) {
      console.warn("Groq 429 rate limit headers:", {
        "retry-after": response.headers.get("retry-after"),
        "x-ratelimit-limit-requests": response.headers.get("x-ratelimit-limit-requests"),
        "x-ratelimit-remaining-requests": response.headers.get("x-ratelimit-remaining-requests"),
        "x-ratelimit-reset-requests": response.headers.get("x-ratelimit-reset-requests"),
        "x-ratelimit-limit-tokens": response.headers.get("x-ratelimit-limit-tokens"),
        "x-ratelimit-remaining-tokens": response.headers.get("x-ratelimit-remaining-tokens"),
        "x-ratelimit-reset-tokens": response.headers.get("x-ratelimit-reset-tokens"),
      });
    }

    if (response.status !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) {
      return response;
    }

    // Groq 무료 티어 분당 요청 제한(429)에 걸린 경우 - 일시적이므로 잠깐 대기 후 재시도.
    // Retry-After를 존중하되, 응답이 너무 오래 걸리지 않도록 상한을 둔다.
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const suggestedDelayMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : BASE_RETRY_DELAY_MS * 2 ** attempt;
    await sleep(Math.min(suggestedDelayMs, MAX_RETRY_DELAY_MS));
  }

  throw new Error("unreachable"); // 루프가 항상 return/throw로 끝나므로 도달 불가
}

export async function detectWithGroq(text: string, mode: ScanMode): Promise<RawFinding[]> {
  let parsed: { findings?: GroqRawItem[] } | null = null;

  for (let attempt = 0; attempt <= MAX_JSON_VALIDATE_RETRIES; attempt++) {
    const response = await callGroqWithRetry(buildPrompt(text, mode));

    if (!response.ok) {
      if (response.status === 429) {
        throw new ApiException(429, "ANALYSIS_FAILED", "AI 탐지 요청이 많아 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.");
      }
      // Groq 서버 자체의 json_validate_failed 등 비정상 응답 - 마지막 시도가 아니면 재시도
      console.warn(`Groq 호출 실패 (status ${response.status}), attempt ${attempt}`);
      if (attempt < MAX_JSON_VALIDATE_RETRIES) continue;
      console.error("Groq가 유효한 JSON을 생성하지 못해 AI 탐지를 건너뜁니다 (정규식 탐지만 적용됨).");
      return [];
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawText = payload.choices?.[0]?.message?.content;
    if (!rawText) {
      if (attempt < MAX_JSON_VALIDATE_RETRIES) continue;
      console.error("Groq 응답에 content가 없어 AI 탐지를 건너뜁니다 (정규식 탐지만 적용됨).");
      return [];
    }

    try {
      parsed = JSON.parse(rawText);
      break;
    } catch {
      if (attempt < MAX_JSON_VALIDATE_RETRIES) continue;
      console.error("Groq 응답이 올바른 JSON이 아니어서 AI 탐지를 건너뜁니다 (정규식 탐지만 적용됨).");
      return [];
    }
  }

  if (!parsed) return [];

  const findings: RawFinding[] = [];
  const seenOffsets = new Set<string>();

  for (const item of parsed.findings ?? []) {
    if (!item.matchedText) continue;

    for (const startOffset of findAllOccurrences(text, item.matchedText)) {
      const endOffset = startOffset + item.matchedText.length;
      const dedupeKey = `${item.type}:${startOffset}:${endOffset}`;
      if (seenOffsets.has(dedupeKey)) continue; // LLM이 같은 문구를 여러 항목으로 중복 보고한 경우 방지
      seenOffsets.add(dedupeKey);

      findings.push({
        type: item.type,
        label: item.label,
        originalText: item.matchedText,
        reason: item.reason,
        severity: item.severity,
        action: item.action,
        suggestion: item.suggestion ?? null,
        startOffset,
        endOffset,
      });
    }
  }

  return findings;
}

// LLM은 반복되는 문구(예: 같은 이름이 문서에 여러 번 등장)를 한 항목으로만 보고하는 경우가 많아,
// 실제로는 원문 전체에서 동일 문자열의 모든 위치를 찾아 각각 별도 finding으로 만들어야 전부 마스킹된다.
function findAllOccurrences(haystack: string, needle: string): number[] {
  const positions: number[] = [];
  let fromIndex = 0;
  while (true) {
    const idx = haystack.indexOf(needle, fromIndex);
    if (idx === -1) break;
    positions.push(idx);
    fromIndex = idx + needle.length;
  }
  return positions;
}
