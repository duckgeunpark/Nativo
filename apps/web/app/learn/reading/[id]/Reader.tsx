"use client";

import { useState } from "react";
import type { Language } from "@nativo/core";
import type { EnrichResult } from "@/app/api/enrich/route";
import { createClient } from "@/lib/supabase/client";
import { addToMyWords, removeFromMyWords } from "@/app/learn/flashcards/dictionary/actions";
import { HeartToggle } from "@/app/learn/flashcards/dictionary/HeartToggle";
import { speak } from "@/lib/tts";

interface Props {
  text: string;
  language: Language;
}

interface Lookup {
  word: string;
  loading: boolean;
  fields: Partial<EnrichResult>;
  /** 이미 '내 단어'에 담겨 있는지 (하트 초기 상태). */
  saved: boolean;
}

const cleanWord = (raw: string) => raw.replace(/^[^\p{L}'-]+|[^\p{L}'-]+$/gu, "");

const SOURCE_LABEL: Record<NonNullable<EnrichResult["source"]>, string> = {
  dictionary: "전체 사전",
  ai: "AI 검색",
  none: "",
};

export function Reader({ text, language }: Props) {
  const [lookup, setLookup] = useState<Lookup | null>(null);

  // 공백 기준 토큰화 — 단어는 클릭 가능
  const tokens = text.split(/(\s+)/);

  async function onWordClick(raw: string) {
    const word = cleanWord(raw);
    if (!word) return;
    setLookup({ word, loading: true, fields: {}, saved: false });
    speak(word, language);

    // 사전 보강 + 이미 담긴 단어인지 동시 확인
    const [fields, saved] = await Promise.all([
      fetchEnrich(word, language),
      isInMyWords(word, language),
    ]);
    setLookup({ word, loading: false, fields, saved });
  }

  return (
    <>
      <article className="whitespace-pre-wrap break-words text-[1.05rem] leading-8">
        {tokens.map((tok, i) =>
          /\s+/.test(tok) ? (
            tok
          ) : (
            <span
              key={i}
              onClick={() => onWordClick(tok)}
              className="cursor-pointer rounded hover:bg-accent"
            >
              {tok}
            </span>
          ),
        )}
      </article>

      {lookup && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg">
          <div className="container max-w-2xl py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{lookup.word}</p>
                  <button
                    type="button"
                    onClick={() => speak(lookup.word, language)}
                    aria-label="발음 듣기"
                  >
                    🔊
                  </button>
                  {lookup.fields.pronunciation && (
                    <span className="text-sm text-muted-foreground">
                      {lookup.fields.pronunciation}
                    </span>
                  )}
                  {!lookup.loading && lookup.fields.source && lookup.fields.source !== "none" && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {SOURCE_LABEL[lookup.fields.source]}
                    </span>
                  )}
                </div>
                {lookup.loading ? (
                  <p className="mt-1 text-sm text-muted-foreground">찾는 중…</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lookup.fields.meaning ??
                      "뜻 정보를 찾지 못했어요 (그래도 하트로 담을 수 있어요)."}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!lookup.loading && (
                  <HeartToggle
                    key={lookup.word}
                    initialActive={lookup.saved}
                    onAdd={() =>
                      addToMyWords({
                        language,
                        word: lookup.word,
                        meaning: lookup.fields.meaning ?? lookup.word,
                        pronunciation: lookup.fields.pronunciation ?? null,
                        example_1: lookup.fields.example_1 ?? null,
                        part_of_speech: lookup.fields.part_of_speech ?? null,
                      })
                    }
                    onRemove={() => removeFromMyWords({ language, word: lookup.word })}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setLookup(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** enrich API 호출 — 전체 사전 1차 검색 → 없으면 AI. */
async function fetchEnrich(
  word: string,
  language: Language,
): Promise<Partial<EnrichResult>> {
  try {
    const res = await fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, language }),
    });
    return res.ok ? ((await res.json()) as Partial<EnrichResult>) : {};
  } catch {
    return {};
  }
}

/** 이 단어가 이미 '내 단어'(source='manual')로 담겨 있는지. */
async function isInMyWords(word: string, language: Language): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("flashcards")
      .select("id")
      .eq("user_id", user.id)
      .eq("language", language)
      .eq("word", word)
      .eq("source", "manual")
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
