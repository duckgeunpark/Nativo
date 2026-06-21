/**
 * 뉘앙스 퀴즈 AI 생성 — 프롬프트 빌더 + 응답 파서(순수, 테스트 가능).
 * 실제 OpenAI 호출은 /api/nuance/quiz 에서 수행한다.
 */

import type { CefrLevel, Language } from "@nativo/core";

const LANGUAGE_NAME: Record<Language, string> = {
  english: "English",
  spanish: "Spanish",
  japanese: "Japanese",
};

/** 뉘앙스 문제 1개. */
export interface NuanceQuestion {
  prompt: string; // 상황 설명 (한국어)
  options: string[]; // 학습 언어 표현 후보 (2~4개)
  answer: number; // 정답 인덱스
  explanation: string; // 한국어 해설
}

/** 생성 문제 수(고정). */
export const NUANCE_QUIZ_COUNT = 5;

export function buildNuancePrompt(language: Language, level: CefrLevel): string {
  const lang = LANGUAGE_NAME[language];
  return [
    `You create nuance/register quizzes for a Korean learner of ${lang} (around level ${level}).`,
    `Each question gives a Korean situation and asks which ${lang} expression fits best (politeness, formality, naturalness).`,
    `Make distractors plausible but subtly wrong in tone/nuance.`,
    `Return STRICT JSON: {"questions":[{`,
    `"prompt":"상황 설명(한국어)",`,
    `"options":["${lang} 표현 A","${lang} 표현 B","${lang} 표현 C"],`,
    `"answer":0,`,
    `"explanation":"왜 그 표현이 맞는지 한국어 해설"`,
    `}]}.`,
    `Generate exactly ${NUANCE_QUIZ_COUNT} questions. prompt/explanation in Korean, options in ${lang}. answer is the 0-based index of the correct option. No text outside JSON.`,
  ].join(" ");
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** AI JSON 응답 → 검증된 문제 배열. options 2개 미만이거나 answer 범위 밖이면 버린다. */
export function parseNuanceQuiz(raw: string): NuanceQuestion[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = (data as { questions?: unknown })?.questions;
  if (!Array.isArray(list)) return [];

  const out: NuanceQuestion[] = [];
  for (const item of list) {
    const o = item as Record<string, unknown>;
    const prompt = str(o.prompt, 400);
    const options = Array.isArray(o.options)
      ? o.options.map((x) => str(x, 300)).filter(Boolean).slice(0, 4)
      : [];
    const answer = typeof o.answer === "number" ? o.answer : Number(o.answer);
    if (!prompt || options.length < 2) continue;
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) continue;
    out.push({
      prompt,
      options,
      answer,
      explanation: str(o.explanation, 500),
    });
  }
  return out;
}
