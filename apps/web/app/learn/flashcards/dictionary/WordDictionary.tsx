"use client";

import { useState } from "react";
import type { Flashcard, Language } from "@nativo/core";
import { createClient } from "@/lib/supabase/client";
import { COMPLETE_THRESHOLD } from "@/lib/flashcards";
import { speak } from "@/lib/tts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HeartToggle } from "./HeartToggle";
import { addToMyWords, removeFromMyWords } from "./actions";

export type WordRow = Pick<
  Flashcard,
  | "id"
  | "word"
  | "meaning"
  | "pronunciation"
  | "difficulty"
  | "language"
  | "repetitions"
  | "source"
>;

export function WordDictionary({
  initial,
  language,
  emptyText = "아직 단어가 없어요.",
  removeOnUnheart = false,
}: {
  initial: WordRow[];
  language: Language;
  emptyText?: string;
  /** true(내 단어 탭)면 하트 해제 시 목록에서 행 제거. */
  removeOnUnheart?: boolean;
}) {
  const [rows, setRows] = useState<WordRow[]>(initial);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) => r.word.toLowerCase().includes(q) || r.meaning.toLowerCase().includes(q),
      )
    : rows;

  async function saveMeaning(id: string) {
    const value = draft.trim();
    if (!value) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("flashcards")
      .update({ meaning: value })
      .eq("id", id);
    if (error) {
      alert(`수정 실패: ${error.message}`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, meaning: value } : r)));
    setEditing(null);
  }

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="단어·뜻 검색…"
        className="mb-4"
      />
      <p className="mb-3 text-sm text-muted-foreground">{filtered.length}개 단어</p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? emptyText : "검색 결과가 없습니다."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => speak(r.word, language)}
                    aria-label="발음 듣기"
                    className="shrink-0"
                  >
                    🔊
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{r.word}</span>
                      {r.difficulty && (
                        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                          {r.difficulty}
                        </span>
                      )}
                      {r.repetitions >= COMPLETE_THRESHOLD ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                          ✓ 완료
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          복습 {r.repetitions}회
                        </span>
                      )}
                    </div>
                    {editing === r.id ? (
                      <div className="mt-1 flex gap-2">
                        <Input
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          className="h-8"
                        />
                        <Button size="sm" onClick={() => saveMeaning(r.id)}>
                          저장
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          취소
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r.id);
                          setDraft(r.meaning);
                        }}
                        className="truncate text-left text-sm text-muted-foreground hover:text-foreground"
                        title="클릭해서 뜻 수정"
                      >
                        {r.meaning}
                      </button>
                    )}
                  </div>
                  <HeartToggle
                    initialActive={r.source !== "curated"}
                    onAdd={() =>
                      addToMyWords({
                        language,
                        word: r.word,
                        meaning: r.meaning,
                        pronunciation: r.pronunciation,
                        difficulty: r.difficulty,
                      })
                    }
                    onRemove={() => removeFromMyWords({ language, word: r.word })}
                    onToggled={(active) => {
                      if (removeOnUnheart && !active) {
                        setRows((prev) => prev.filter((x) => x.id !== r.id));
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
