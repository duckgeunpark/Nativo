"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { chunkReviewUpdate, type StudyChunk } from "@/lib/chunk-review";
import { addToMyChunks, removeFromMyChunks } from "./dictionary/actions";
import { speak } from "@/lib/tts";
import { CATEGORY_LABEL } from "@/lib/chunks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeartToggle } from "@/app/learn/flashcards/dictionary/HeartToggle";

export function ChunkReviewSession({ chunks }: { chunks: StudyChunk[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const chunk = chunks[index];
  const done = index >= chunks.length;

  // 새 청크가 나오면 한 번 읽어준다.
  useEffect(() => {
    if (chunk) speak(chunk.expression, chunk.language);
  }, [chunk?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function next() {
    if (!chunk || saving) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("chunks")
      .update(chunkReviewUpdate(chunk.review_count))
      .eq("id", chunk.id);
    setSaving(false);
    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }
    setReviewed((n) => n + 1);
    setIndex((i) => i + 1);
    setFlipped(false);
  }

  if (done) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-5xl">✅</p>
          <p className="mt-3 font-semibold">{reviewed}개 청크 복습 완료!</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/learn/chunks/dictionary">내 청크 사전</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">홈으로</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <span className="text-sm text-muted-foreground">
          {index + 1} / {chunks.length}
        </span>
      </div>

      <Card>
        <CardContent className="min-h-56 p-0">
          {chunk!.category && (
            <div className="flex justify-end px-4 pt-3">
              <Badge variant="muted">
                {CATEGORY_LABEL[chunk!.category] ?? chunk!.category}
              </Badge>
            </div>
          )}
          {/* 상단: 표현 — 탭하면 발음 듣기 */}
          <button
            type="button"
            onClick={() => speak(chunk!.expression, chunk!.language)}
            aria-label="발음 듣기"
            className="flex w-full items-center justify-center gap-3 px-6 pb-4 pt-2 transition hover:bg-secondary/20"
          >
            <span className="text-2xl font-bold">{chunk!.expression}</span>
            <span className="text-xl">🔊</span>
          </button>
          {/* 하단: 탭하면 뜻 보기/숨기기 */}
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label="뜻 보기"
            className="block min-h-24 w-full select-none border-t px-6 py-6 text-left transition hover:bg-secondary/30"
          >
            {flipped ? (
              <div className="space-y-2 text-sm">
                <p className="text-lg font-medium">{chunk!.translation_ko}</p>
                {chunk!.situation && (
                  <p className="text-muted-foreground">상황: {chunk!.situation}</p>
                )}
                {chunk!.nuance && (
                  <p className="text-muted-foreground">뉘앙스: {chunk!.nuance}</p>
                )}
                {chunk!.example_1 && (
                  <p className="text-muted-foreground">· {chunk!.example_1}</p>
                )}
                {chunk!.example_2 && (
                  <p className="text-muted-foreground">· {chunk!.example_2}</p>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">탭하여 뜻 보기</p>
            )}
          </button>
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center gap-2">
        <Button
          type="button"
          className="flex-1"
          disabled={saving || !flipped}
          onClick={next}
        >
          다음
        </Button>
        <HeartToggle
          initialActive={chunk!.source === "manual"}
          onAdd={() =>
            addToMyChunks({
              language: chunk!.language,
              expression: chunk!.expression,
              translation_ko: chunk!.translation_ko ?? chunk!.expression,
              situation: chunk!.situation,
              nuance: chunk!.nuance,
              example_1: chunk!.example_1,
              example_2: chunk!.example_2,
              category: chunk!.category,
              level: chunk!.level,
            })
          }
          onRemove={() =>
            removeFromMyChunks({ language: chunk!.language, expression: chunk!.expression })
          }
        />
      </div>
    </div>
  );
}
