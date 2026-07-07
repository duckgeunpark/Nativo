"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { DocCover } from "./DocCover";
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
      <Link href={`/learn/reading/${id}`} className="block">
        <DocCover
          title={title}
          badge="PDF"
          className="shadow-sm transition-transform hover:-translate-y-0.5"
        />
        <p className="mt-2 line-clamp-2 pr-5 text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">내 문서 · {totalPages}쪽</p>
      </Link>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="문서 삭제"
        title="삭제"
        className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm transition hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
