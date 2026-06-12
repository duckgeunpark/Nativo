"use client";

import { useState } from "react";
import type { Language, TablesInsert } from "@nativo/core";
import type { EnrichedFields } from "@/lib/dictionary";
import { createClient } from "@/lib/supabase/client";
import { speak } from "@/lib/tts";
import { Button } from "@/components/ui/button";

interface Props {
  text: string;
  language: Language;
}

interface Lookup {
  word: string;
  loading: boolean;
  fields: Partial<EnrichedFields>;
  added: boolean;
}

const cleanWord = (raw: string) => raw.replace(/^[^\p{L}'-]+|[^\p{L}'-]+$/gu, "");

export function Reader({ text, language }: Props) {
  const [lookup, setLookup] = useState<Lookup | null>(null);

  // 공백 기준 토큰화 — 단어는 클릭 가능
  const tokens = text.split(/(\s+)/);

  async function onWordClick(raw: string) {
    const word = cleanWord(raw);
    if (!word) return;
    setLookup({ word, loading: true, fields: {}, added: false });
    speak(word, language);

    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, language }),
      });
      const fields = res.ok ? ((await res.json()) as Partial<EnrichedFields>) : {};
      setLookup({ word, loading: false, fields, added: false });
    } catch {
      setLookup({ word, loading: false, fields: {}, added: false });
    }
  }

  async function addCard() {
    if (!lookup) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload: TablesInsert<"flashcards"> = {
      user_id: user.id,
      language,
      word: lookup.word,
      meaning: lookup.fields.meaning ?? lookup.word,
      meaning_en: lookup.fields.meaning_en ?? null,
      pronunciation: lookup.fields.pronunciation ?? null,
      example_1: lookup.fields.example_1 ?? null,
      part_of_speech: lookup.fields.part_of_speech ?? null,
      source: "reading",
    };
    const { error } = await supabase.from("flashcards").insert(payload);
    if (!error) setLookup({ ...lookup, added: true });
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
                </div>
                {lookup.loading ? (
                  <p className="mt-1 text-sm text-muted-foreground">찾는 중…</p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {lookup.fields.meaning ?? "뜻 정보를 찾지 못했어요 (그래도 카드로 담을 수 있어요)."}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLookup(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
            <div className="mt-3">
              {lookup.added ? (
                <p className="text-sm font-medium text-success">✓ 플래시카드에 추가됨</p>
              ) : (
                <Button size="sm" onClick={addCard} disabled={lookup.loading}>
                  📚 플래시카드에 추가
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
