"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { WritingCorrection } from "@nativo/core";
import { Card, CardContent } from "@/components/ui/card";
import { deleteJournalEntry } from "./actions";

interface Props {
  id: string;
  entryDate: string;
  content: string;
  aiFeedback: string | null;
  corrections: WritingCorrection[];
  wordCount: number;
}

/** 첫 줄을 제목으로 사용 — 없으면 "제목 없음", 길면 한 줄로 잘라 보여준다. */
function deriveTitle(content: string): string {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0)?.trim();
  return firstLine || "제목 없음";
}

export function JournalEntryItem({ id, entryDate, content, aiFeedback, corrections, wordCount }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!confirm("이 일기를 삭제할까요?")) return;
    startTransition(async () => {
      const res = await deleteJournalEntry(id);
      if (!res.ok) {
        setError(res.error ?? "삭제 실패");
        return;
      }
      router.refresh();
    });
  }

  const title = deriveTitle(content);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">
              {entryDate} · {wordCount} 단어
            </p>
          </div>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label="일기 삭제"
            title="삭제"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="whitespace-pre-wrap text-sm">{content}</p>
        {aiFeedback && (
          <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            {aiFeedback}
          </p>
        )}
        {corrections.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">첨삭 {corrections.length}건</p>
        )}
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
