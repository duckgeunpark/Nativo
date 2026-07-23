import { NextResponse } from "next/server";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { enrichWordFull, type EnrichedFields } from "@/lib/dictionary";
import { lookupWordDb } from "@/lib/word-db";
import { getCachedWord, putCachedWord } from "@/lib/dictionary-cache";

const LANGUAGES = ["english", "spanish", "japanese"];

/** enrich 응답: 보강 필드 + 출처(정적 사전 / 캐시 / DeepL / AI). */
export interface EnrichResult extends Partial<EnrichedFields> {
  source: "dictionary" | "cache" | "deepl" | "ai" | "none";
}

/**
 * 단어 뜻 보강 프록시 (외부 사전 API를 서버에서 호출 → CORS 회피).
 *
 * 조회 순서:
 *  1차  정적 word-db(JSON)   — 있으면 한국어 뜻 즉시 반환
 *  2차  dictionary_cache     — 예전에 DeepL/사전으로 채워 둔 캐시
 *  3차  DeepL(한국어) + 사전 API(발음·예문) 병렬 조회
 *  4차  3차 결과를 캐시에 저장 → 다음부터 2차에서 히트
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { word?: unknown; language?: unknown }
    | null;
  const word = typeof body?.word === "string" ? body.word.trim() : "";
  const language = body?.language;

  if (!word || typeof language !== "string" || !LANGUAGES.includes(language)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const lang = language as Language;

  // 1차: 정적 word-db 정확 조회 — 있으면 한국어 뜻을 바로 사용.
  const hit = lookupWordDb(lang, word);
  if (hit) {
    const result: EnrichResult = {
      meaning: hit.meaning,
      meaning_en: hit.meaning_en ?? null,
      pronunciation: hit.pronunciation ?? null,
      example_1: hit.example_1 ?? null,
      part_of_speech: hit.part_of_speech ?? null,
      source: "dictionary",
    };
    return NextResponse.json(result);
  }

  // 2차: 캐시 조회 — 이전 DeepL/사전 결과 재사용(외부 호출·쿼터 절약).
  const cached = await getCachedWord(lang, word);
  if (cached) {
    const result: EnrichResult = {
      meaning: cached.meaning,
      meaning_en: cached.meaning_en ?? null,
      pronunciation: cached.pronunciation ?? null,
      example_1: cached.example_1 ?? null,
      part_of_speech: cached.part_of_speech ?? null,
      source: "cache",
    };
    return NextResponse.json(result);
  }

  // 3차: DeepL(한국어 뜻) + 사전 API(발음·예문·품사) 병렬 보강.
  const { fields, usedDeepL } = await enrichWordFull(word, lang);
  const hasAny = Object.values(fields).some((v) => v != null && v !== "");
  if (!hasAny) {
    return NextResponse.json({ source: "none" } satisfies EnrichResult);
  }

  const source: EnrichResult["source"] = usedDeepL ? "deepl" : "ai";

  // 4차: 뜻이 있으면 캐시에 저장(다음 조회부터 2차 히트). 저장 실패는 무시.
  if (fields.meaning) {
    try {
      await putCachedWord(lang, word, {
        meaning: fields.meaning,
        meaning_en: fields.meaning_en ?? undefined,
        pronunciation: fields.pronunciation ?? undefined,
        example_1: fields.example_1 ?? undefined,
        part_of_speech: fields.part_of_speech ?? undefined,
        source,
      });
    } catch {
      // 캐시 저장 실패해도 조회 결과는 정상 반환
    }
  }

  return NextResponse.json({ ...fields, source } satisfies EnrichResult);
}
