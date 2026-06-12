"use client";

import { useState } from "react";
import type { Chunk, Language } from "@nativo/core";
import { speak } from "@/lib/tts";
import { CHUNK_COMPLETE_THRESHOLD } from "@/lib/chunk-review";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { HeartToggle } from "@/app/learn/flashcards/dictionary/HeartToggle";
import { addToMyChunks, removeFromMyChunks } from "./actions";

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
                <CardContent className="flex items-start gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => speak(r.expression, language)}
                    aria-label="발음 듣기"
                    className="shrink-0 pt-0.5 text-lg"
                  >
                    🔊
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{r.expression}</span>
                      {r.category && (
                        <Badge variant="muted">
                          {CATEGORY_LABEL[r.category] ?? r.category}
                        </Badge>
                      )}
                      {r.review_count >= CHUNK_COMPLETE_THRESHOLD ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
                          ✓ 완료
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          복습 {r.review_count}회
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{r.translation_ko}</p>
                  </div>
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
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
