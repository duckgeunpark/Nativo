/**
 * 청크 AI 생성 — 프롬프트 빌더 + 응답 파서(순수, 테스트 가능).
 * 실제 OpenAI 호출은 /api/chunks/generate 에서 수행한다.
 */

import type { CefrLevel, ChunkCategory, Language } from "@nativo/core";

const LANGUAGE_NAME: Record<Language, string> = {
  english: "English",
  spanish: "Spanish",
  japanese: "Japanese",
};

const CATEGORIES: ChunkCategory[] = ["daily", "business", "travel", "social", "custom"];
const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/** AI가 생성한 청크 1건(저장 전 정규화된 형태). */
export interface GeneratedChunk {
  expression: string;
  translation_ko: string;
  situation: string;
  nuance: string;
  example_1: string;
  example_2: string;
  category: ChunkCategory;
  level: CefrLevel;
}

/** 청크 생성 요청 개수(고정). */
export const CHUNK_GEN_COUNT = 10;

export function buildChunkGenPrompt(
  language: Language,
  situation: string,
  level: CefrLevel,
): string {
  const lang = LANGUAGE_NAME[language];
  return [
    `You generate natural ${lang} "chunks" (useful multi-word expressions/collocations) for a Korean learner.`,
    `Target situation: "${situation}". Learner CEFR level: around ${level}.`,
    `Produce exactly ${CHUNK_GEN_COUNT} distinct, genuinely useful ${lang} chunks a native speaker would actually say in that situation.`,
    `Return STRICT JSON: {"chunks":[{`,
    `"expression":"the ${lang} chunk",`,
    `"translation_ko":"자연스러운 한국어 뜻",`,
    `"situation":"언제 쓰는지 한국어 한 줄",`,
    `"nuance":"뉘앙스/격식도 한국어 한 줄",`,
    `"example_1":"${lang} 예문",`,
    `"example_2":"${lang} 예문",`,
    `"category":"one of daily|business|travel|social|custom",`,
    `"level":"one of A1|A2|B1|B2|C1|C2"`,
    `}]}.`,
    `All Korean fields in Korean, all ${lang} fields in ${lang}. No commentary outside JSON.`,
  ].join(" ");
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * AI JSON 응답을 검증·정규화한다. 잘못된 항목은 버리고, 카테고리/레벨은 화이트리스트로 보정.
 * @param fallbackCategory 카테고리 누락/오류 시 기본값
 */
export function parseGeneratedChunks(
  raw: string,
  fallbackCategory: ChunkCategory = "custom",
): GeneratedChunk[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = (data as { chunks?: unknown })?.chunks;
  if (!Array.isArray(list)) return [];

  const out: GeneratedChunk[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const o = item as Record<string, unknown>;
    const expression = str(o.expression, 200);
    const translation_ko = str(o.translation_ko, 200);
    if (!expression || !translation_ko) continue;
    const key = expression.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const category = CATEGORIES.includes(o.category as ChunkCategory)
      ? (o.category as ChunkCategory)
      : fallbackCategory;
    const level = LEVELS.includes(o.level as CefrLevel)
      ? (o.level as CefrLevel)
      : "B1";

    out.push({
      expression,
      translation_ko,
      situation: str(o.situation, 300),
      nuance: str(o.nuance, 300),
      example_1: str(o.example_1, 300),
      example_2: str(o.example_2, 300),
      category,
      level,
    });
  }
  return out;
}
