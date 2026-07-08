"use client";

import { Volume2 } from "lucide-react";
import type { Language } from "@nativo/core";
import { speak } from "@/lib/tts";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { HeartToggle } from "@/app/learn/flashcards/dictionary/HeartToggle";
import { addToMyChunks, removeFromMyChunks } from "./actions";

export interface AllChunk {
  expression: string;
  translation_ko: string;
  situation?: string | null;
  nuance?: string | null;
  example_1?: string | null;
  example_2?: string | null;
  category?: string | null;
  level?: string | null;
}

/** chunk-db 전체 청크 목록. 각 행 끝의 하트로 '내 청크' 추가/제거 토글. */
export function AllChunksList({
  chunks,
  language,
  owned,
  hasQuery = false,
}: {
  chunks: AllChunk[];
  language: Language;
  /** 이미 '내 청크'인 표현들(소문자). */
  owned: string[];
  /** 검색어/분류/레벨 필터가 걸려 있으면 "검색 결과 없음" 문구를 보여준다. */
  hasQuery?: boolean;
}) {
  const ownedSet = new Set(owned.map((w) => w.toLowerCase()));

  if (chunks.length === 0) {
    return hasQuery ? (
      <EmptyState
        icon="🔍"
        title="조건에 맞는 청크가 없어요"
        description="검색어나 분류·레벨 필터를 조정해 보세요."
      />
    ) : (
      <EmptyState icon="📭" title="표시할 청크가 없어요" />
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {chunks.map((c) => (
        <li key={c.expression}>
          <Card className="h-full">
            <CardContent className="flex h-full items-start gap-3 p-3">
              <button
                type="button"
                onClick={() => speak(c.expression, language)}
                aria-label="발음 듣기"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <Volume2 className="h-4 w-4" aria-hidden />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-medium">{c.expression}</span>
                  {c.category && (
                    <Badge variant="muted">{CATEGORY_LABEL[c.category] ?? c.category}</Badge>
                  )}
                  {c.level && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                      {c.level}
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                  {c.translation_ko}
                </p>
                {c.example_1 && (
                  <p className="line-clamp-1 break-words text-xs text-muted-foreground">
                    · {c.example_1}
                  </p>
                )}
              </div>
              <HeartToggle
                initialActive={ownedSet.has(c.expression.toLowerCase())}
                onAdd={() =>
                  addToMyChunks({
                    language,
                    expression: c.expression,
                    translation_ko: c.translation_ko,
                    situation: c.situation,
                    nuance: c.nuance,
                    example_1: c.example_1,
                    example_2: c.example_2,
                    category: c.category,
                    level: c.level,
                  })
                }
                onRemove={() =>
                  removeFromMyChunks({ language, expression: c.expression })
                }
              />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
