"use client";

import type { Language } from "@nativo/core";
import { speak } from "@/lib/tts";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}: {
  chunks: AllChunk[];
  language: Language;
  /** 이미 '내 청크'인 표현들(소문자). */
  owned: string[];
}) {
  const ownedSet = new Set(owned.map((w) => w.toLowerCase()));

  if (chunks.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          조건에 맞는 청크가 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {chunks.map((c) => (
        <li key={c.expression}>
          <Card>
            <CardContent className="flex items-start gap-3 p-3">
              <button
                type="button"
                onClick={() => speak(c.expression, language)}
                aria-label="발음 듣기"
                className="shrink-0 pt-0.5 text-lg"
              >
                🔊
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.expression}</span>
                  {c.category && (
                    <Badge variant="muted">{CATEGORY_LABEL[c.category] ?? c.category}</Badge>
                  )}
                  {c.level && (
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
                      {c.level}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{c.translation_ko}</p>
                {c.example_1 && (
                  <p className="truncate text-xs text-muted-foreground">· {c.example_1}</p>
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
