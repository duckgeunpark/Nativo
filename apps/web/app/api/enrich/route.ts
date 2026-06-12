import { NextResponse } from "next/server";
import type { Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/server";
import { enrichWord, type EnrichedFields } from "@/lib/dictionary";
import { lookupWordDb } from "@/lib/word-db";

const LANGUAGES = ["english", "spanish", "japanese"];

/** enrich 응답: 보강 필드 + 출처(전체 사전 / AI). */
export interface EnrichResult extends Partial<EnrichedFields> {
  source: "dictionary" | "ai" | "none";
}

/** 단어 뜻 보강 프록시 (외부 사전 API를 서버에서 호출 → CORS 회피). */
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

  // 1차: 전체 사전(word-db) 정확 조회 — 있으면 한국어 뜻을 바로 사용.
  const hit = lookupWordDb(language as Language, word);
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

  // 2차: 외부 사전 / AI 보강.
  const fields = await enrichWord(word, language as Language);
  const hasAny = Object.values(fields).some((v) => v != null && v !== "");
  const result: EnrichResult = { ...fields, source: hasAny ? "ai" : "none" };
  return NextResponse.json(result);
}
