"use client";

import type { Language } from "@nativo/core";
import { speak } from "@/lib/tts";
import { Card, CardContent } from "@/components/ui/card";
import { HeartToggle } from "./HeartToggle";
import { addToMyWords, removeFromMyWords } from "./actions";

export interface AllWord {
  word: string;
  meaning: string;
  pronunciation?: string | null;
  difficulty?: string | null;
  example_1?: string | null;
  part_of_speech?: string | null;
}

/**
 * word-db 전체 단어 목록. 각 행 끝의 하트로 '내 단어' 추가/제거 토글.
 * 검색·페이지네이션은 상위 서버 컴포넌트가 담당.
 */
export function AllWordsList({
  words,
  language,
  owned,
}: {
  words: AllWord[];
  language: Language;
  /** 이미 '내 단어'(source != curated)인 단어들(소문자) — 하트 초기 상태. */
  owned: string[];
}) {
  const ownedSet = new Set(owned.map((w) => w.toLowerCase()));

  if (words.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          검색 결과가 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {words.map((w) => (
        <li key={w.word}>
          <Card>
            <CardContent className="flex items-center gap-3 p-3">
              <button
                type="button"
                onClick={() => speak(w.word, language)}
                aria-label="발음 듣기"
                className="shrink-0"
              >
                🔊
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{w.word}</span>
                  {w.difficulty && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                      {w.difficulty}
                    </span>
                  )}
                  {w.pronunciation && (
                    <span className="truncate text-xs text-muted-foreground">
                      {w.pronunciation}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-muted-foreground">{w.meaning}</p>
              </div>
              <HeartToggle
                initialActive={ownedSet.has(w.word.toLowerCase())}
                onAdd={() =>
                  addToMyWords({
                    language,
                    word: w.word,
                    meaning: w.meaning,
                    pronunciation: w.pronunciation,
                    example_1: w.example_1,
                    part_of_speech: w.part_of_speech,
                    difficulty: w.difficulty,
                  })
                }
                onRemove={() => removeFromMyWords({ language, word: w.word })}
              />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
