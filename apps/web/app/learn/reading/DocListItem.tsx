"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { deleteDocument } from "./actions";

interface Props {
  id: string;
  title: string;
  totalPages: number;
}

export function DocListItem({ id, title, totalPages }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm("이 문서를 삭제할까요?")) return;
    startTransition(async () => {
      const res = await deleteDocument(id);
      if (!res.ok) {
        setError(res.error ?? "삭제 실패");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <Link href={`/learn/reading/${id}`}>
        <Card className="h-full transition-colors hover:bg-secondary/40">
          <CardContent className="p-4">
            <p className="line-clamp-2 pr-6 font-medium">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">내 문서 · {totalPages}쪽</p>
          </CardContent>
        </Card>
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="문서 삭제"
        title="삭제"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-sm text-white transition hover:bg-destructive disabled:opacity-50"
      >
        ✕
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
