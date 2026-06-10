"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Language, TablesInsert } from "@nativo/core";
import type { EnrichedFields } from "@/lib/dictionary";
import { createClient } from "@/lib/supabase/client";
import { speak } from "@/lib/tts";

interface Props {
  words: string[];
  existing: string[];
  language: Language;
}

export function WordBankList({ words, existing, language }: Props) {
  const router = useRouter();
  const [added, setAdded] = useState<Set<string>>(new Set(existing));
  const [adding, setAdding] = useState<string | null>(null);

  async function add(word: string) {
    if (added.has(word) || adding) return;
    setAdding(word);

    // 1) 사전 API로 뜻/발음/예문 보강 (실패해도 단어는 추가)
    let fields: Partial<EnrichedFields> = {};
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, language }),
      });
      if (res.ok) fields = await res.json();
    } catch {
      // 무시 — 아래에서 meaning 기본값 처리
    }

    // 2) 카드 insert
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const payload: TablesInsert<"flashcards"> = {
      user_id: user.id,
      language,
      word,
      meaning: fields.meaning ?? word, // 보강 실패 시 단어 자체로(추후 보강 가능)
      meaning_en: fields.meaning_en ?? null,
      pronunciation: fields.pronunciation ?? null,
      example_1: fields.example_1 ?? null,
      part_of_speech: fields.part_of_speech ?? null,
      source: "curated",
    };

    const { error } = await supabase.from("flashcards").insert(payload);
    setAdding(null);
    if (error) {
      alert(`추가 실패: ${error.message}`);
      return;
    }
    setAdded((prev) => new Set(prev).add(word));
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {words.map((word) => {
        const isAdded = added.has(word);
        const isAdding = adding === word;
        return (
          <li
            key={word}
            className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2"
          >
            <button
              type="button"
              onClick={() => speak(word, language)}
              className="truncate text-left hover:text-brand"
              title="발음 듣기"
            >
              {word}
            </button>
            <button
              type="button"
              disabled={isAdded || isAdding}
              onClick={() => add(word)}
              className={`shrink-0 rounded px-2 py-1 text-xs transition ${
                isAdded
                  ? "text-green-600"
                  : "border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
              }`}
            >
              {isAdded ? "✓" : isAdding ? "…" : "+ 추가"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
