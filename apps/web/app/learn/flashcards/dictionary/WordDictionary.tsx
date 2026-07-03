"use client";

import { useState } from "react";
import type { Flashcard, Language } from "@nativo/core";
import { COMPLETE_THRESHOLD } from "@/lib/flashcards";
import { speak } from "@/lib/tts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { HeartToggle } from "./HeartToggle";
import {
  addToMyWords,
  removeFromMyWords,
  deleteWord,
  updateWordMeaning,
} from "./actions";

export type WordRow = Pick<
  Flashcard,
  | "id"
  | "word"
  | "meaning"
  | "pronunciation"
  | "difficulty"
  | "language"
  | "repetitions"
  | "last_grade"
  | "source"
>;

/** 자주 틀리는 단어 판정: 마지막 채점이 정답선(3) 미만. */
function isStruggling(r: WordRow): boolean {
  return r.last_grade !== null && r.last_grade < 3;
}

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
  const [strugglingOnly, setStrugglingOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const strugglingCount = rows.filter(isStruggling).length;

  const q = query.trim().toLowerCase();
  const filtered = rows
    .filter((r) => (strugglingOnly ? isStruggling(r) : true))
    .filter((r) =>
      q ? r.word.toLowerCase().includes(q) || r.meaning.toLowerCase().includes(q) : true,
    );

  async function saveMeaning(id: string) {
    const value = draft.trim();
    if (!value) return;
    const res = await updateWordMeaning(id, value);
    if (!res.ok) {
      setError(`수정 실패: ${res.error ?? "알 수 없는 오류"}`);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, meaning: value } : r)));
    setEditing(null);
    setError(null);
  }

  async function remove(id: string) {
    if (busy) return;
    if (!confirm("이 단어를 사전에서 완전히 삭제할까요? 학습 기록도 함께 사라집니다.")) return;
    setBusy(id);
    setError(null);
    const res = await deleteWord({ id });
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "삭제 실패");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="단어·뜻 검색…"
        className="mb-3"
      />
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{filtered.length}개 단어</p>
        {strugglingCount > 0 && (
          <button
            type="button"
            onClick={() => setStrugglingOnly((v) => !v)}
            aria-pressed={strugglingOnly}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              strugglingOnly
                ? "border-destructive bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:bg-secondary",
            )}
          >
            자주 틀리는 단어 {strugglingCount}
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

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
                      {isStruggling(r) && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                          자주 틀림
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
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={busy === r.id}
                    aria-label="단어 삭제"
                    title="사전에서 완전히 삭제"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    🗑
                  </button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
