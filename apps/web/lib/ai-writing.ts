/**
 * 영작 일기 AI 첨삭 — 프롬프트 빌더 + 응답 파서(순수, 테스트 가능).
 * 실제 OpenAI 호출은 /api/journal/feedback 에서 수행한다.
 */

import type { Language } from "@nativo/core";
import type { WritingCorrection } from "@nativo/core";

const LANGUAGE_NAME: Record<Language, string> = {
  english: "English",
  spanish: "Spanish",
  japanese: "Japanese",
};

/** /api/journal/feedback 응답 형태. */
export interface WritingFeedback {
  summary: string; // 한국어 총평
  corrections: WritingCorrection[]; // { original, corrected, reason }
}

export function buildWritingPrompt(language: Language): string {
  const lang = LANGUAGE_NAME[language];
  return [
    `You are a supportive ${lang} writing tutor for a Korean learner.`,
    `The learner wrote a short journal entry in ${lang}. Correct grammar, word choice, and naturalness.`,
    `Return STRICT JSON: {"summary":"한국어 총평(2-3문장, 격려 포함)",`,
    `"corrections":[{"original":"원문 중 고칠 부분","corrected":"자연스럽게 고친 ${lang}","reason":"한국어로 이유"}]}.`,
    `Only include corrections that matter (max 8). If the writing is already good, return an empty corrections array and say so in the summary.`,
    `summary and reason MUST be in Korean. corrected MUST be in ${lang}. No text outside JSON.`,
  ].join(" ");
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** AI JSON 응답 → 검증된 WritingFeedback. 잘못된 항목은 버린다. */
export function parseWritingFeedback(raw: string): WritingFeedback {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { summary: "", corrections: [] };
  }
  const o = data as { summary?: unknown; corrections?: unknown };
  const summary = str(o.summary, 600);
  const corrections: WritingCorrection[] = Array.isArray(o.corrections)
    ? o.corrections
        .map((c) => {
          const r = c as Record<string, unknown>;
          return {
            original: str(r.original, 300),
            corrected: str(r.corrected, 300),
            reason: str(r.reason, 300),
          };
        })
        .filter((c) => c.original && c.corrected)
        .slice(0, 8)
    : [];
  return { summary, corrections };
}

/** 단어 수(공백 분할 근사 — 일본어 등은 대략치). */
export function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}
