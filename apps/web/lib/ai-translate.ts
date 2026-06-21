/**
 * 번역가 모드 AI 평가 — 프롬프트 빌더 + 응답 파서(순수, 테스트 가능).
 * 실제 OpenAI 호출은 /api/translate/evaluate 에서 수행한다.
 */

import type { Language, TranslationFeedback } from "@nativo/core";

const LANGUAGE_NAME: Record<Language, string> = {
  english: "English",
  spanish: "Spanish",
  japanese: "Japanese",
};

/** /api/translate/evaluate 응답 형태. (translation_sessions 점수 컬럼과 매핑) */
export interface TranslationEvaluation {
  score_total: number; // 0~100
  score_accuracy: number; // 0~40
  score_naturalness: number; // 0~30
  score_nuance: number; // 0~30
  passed: boolean; // 80점 이상
  feedback: TranslationFeedback; // { good_points, improvements }
}

/** 합격 기준(번역가 모드). */
export const TRANSLATION_PASS_SCORE = 80;

export function buildTranslatePrompt(language: Language): string {
  const lang = LANGUAGE_NAME[language];
  return [
    `You are a professional ${lang}→Korean translation evaluator.`,
    `The learner translated a ${lang} passage into Korean. Judge their Korean translation against the original.`,
    `Score: accuracy (0-40, meaning preserved), naturalness (0-30, reads like native Korean), nuance (0-30, tone/register).`,
    `Return STRICT JSON: {"score_accuracy":0-40,"score_naturalness":0-30,"score_nuance":0-30,`,
    `"feedback":{"good_points":["한국어 잘한 점"],`,
    `"improvements":[{"original":"원문/학습자 번역 일부","recommended":"더 자연스러운 한국어","reason":"한국어 설명"}]}}.`,
    `All feedback text in Korean. Be specific and encouraging. Max 5 improvements. No text outside JSON.`,
  ].join(" ");
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** AI JSON 응답 → 검증된 평가. 점수는 범위 클램프, 총점은 합산. */
export function parseTranslationEvaluation(raw: string): TranslationEvaluation {
  let data: unknown = {};
  try {
    data = JSON.parse(raw);
  } catch {
    /* 기본값으로 진행 */
  }
  const o = data as Record<string, unknown>;
  const score_accuracy = clampInt(o.score_accuracy, 0, 40);
  const score_naturalness = clampInt(o.score_naturalness, 0, 30);
  const score_nuance = clampInt(o.score_nuance, 0, 30);
  const score_total = score_accuracy + score_naturalness + score_nuance;

  const fbRaw = (o.feedback ?? {}) as Record<string, unknown>;
  const good_points = Array.isArray(fbRaw.good_points)
    ? fbRaw.good_points.map((g) => str(g, 300)).filter(Boolean).slice(0, 5)
    : [];
  const improvements = Array.isArray(fbRaw.improvements)
    ? fbRaw.improvements
        .map((it) => {
          const r = it as Record<string, unknown>;
          return {
            original: str(r.original, 400),
            recommended: str(r.recommended, 400),
            reason: str(r.reason, 400),
          };
        })
        .filter((it) => it.original && it.recommended)
        .slice(0, 5)
    : [];

  return {
    score_total,
    score_accuracy,
    score_naturalness,
    score_nuance,
    passed: score_total >= TRANSLATION_PASS_SCORE,
    feedback: { good_points, improvements },
  };
}
