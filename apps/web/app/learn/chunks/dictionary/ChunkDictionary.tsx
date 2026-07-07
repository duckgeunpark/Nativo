"use client";

import { useState } from "react";
import { Volume2, Trash2 } from "lucide-react";
import type { Chunk, Language } from "@nativo/core";
import { speak } from "@/lib/tts";
import { CHUNK_COMPLETE_THRESHOLD } from "@/lib/chunk-review";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorBanner } from "@/components/ui/states";
import { HeartToggle } from "@/app/learn/flashcards/dictionary/HeartToggle";
import { addToMyChunks, removeFromMyChunks, deleteChunk } from "./actions";

export type ChunkRow = Pick<
  Chunk,
  | "id"
  | "expression"
  | "translation_ko"
  | "situation"
  | "nuance"
  | "example_1"
  | "example_2"
  | "category"
  | "level"
  | "review_count"
  | "source"
>;

export function ChunkDictionary({
  initial,
  language,
  emptyText = "아직 청크가 없어요.",
  removeOnUnheart = false,
}: {
  initial: ChunkRow[];
  language: Language;
  emptyText?: string;
  /** true(내 청크 탭)면 하트 해제 시 목록에서 행 제거. */
  removeOnUnheart?: boolean;
}) {
  const [rows, setRows] = useState<ChunkRow[]>(initial);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    if (busy) return;
    if (!confirm("이 청크를 사전에서 완전히 삭제할까요? 학습 기록도 함께 사라집니다.")) return;
    setBusy(id);
    setError(null);
    const res = await deleteChunk({ id });
    setBusy(null);
    if (!res.ok) {
      setError(res.error ?? "삭제 실패");
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.expression.toLowerCase().includes(q) ||
          (r.translation_ko ?? "").toLowerCase().includes(q),
      )
    : rows;

  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="표현·뜻 검색…"
        className="mb-4"
      />
      <p className="mb-3 text-sm text-muted-foreground">{filtered.length}개 청크</p>

      <ErrorBanner message={error} className="mb-3" />

      {filtered.length === 0 ? (
        rows.length === 0 ? (
          <EmptyState icon="📭" title={emptyText} />
        ) : (
          <EmptyState
            icon="🔍"
            title="검색 결과가 없어요"
            description="다른 표현이나 뜻으로 다시 검색해 보세요."
          />
        )
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex items-start gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => speak(r.expression, language)}
                    aria-label="발음 듣기"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  >
                    <Volume2 className="h-4 w-4" aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-medium">{r.expression}</span>
                      {r.category && (
                        <Badge variant="muted">
                          {CATEGORY_LABEL[r.category] ?? r.category}
                        </Badge>
                      )}
                      {r.review_count >= CHUNK_COMPLETE_THRESHOLD ? (
                        <Badge variant="success">완료</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          복습 {r.review_count}회
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                      {r.translation_ko}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <HeartToggle
                      initialActive={r.source === "manual"}
                      onAdd={() =>
                        addToMyChunks({
                          language,
                          expression: r.expression,
                          translation_ko: r.translation_ko ?? r.expression,
                          situation: r.situation,
                          nuance: r.nuance,
                          example_1: r.example_1,
                          example_2: r.example_2,
                          category: r.category,
                          level: r.level,
                        })
                      }
                      onRemove={() =>
                        removeFromMyChunks({ language, expression: r.expression })
                      }
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
                      aria-label="청크 삭제"
                      title="사전에서 완전히 삭제"
                      className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
