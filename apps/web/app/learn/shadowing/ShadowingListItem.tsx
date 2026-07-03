"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { deleteShadowingVideo } from "./actions";

interface Props {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  youtubeVideoId: string;
  lastPositionSec: number;
  completed: boolean;
}

export function ShadowingListItem({
  id,
  title,
  thumbnailUrl,
  youtubeVideoId,
  lastPositionSec,
  completed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("이 영상을 목록에서 삭제할까요? (저장한 자막·진행도 함께 삭제)")) return;
    startTransition(async () => {
      const res = await deleteShadowingVideo(id);
      if (!res.ok) {
        setError(res.error ?? "삭제 실패");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <Link href={`/learn/shadowing/${id}`}>
        <Card className="overflow-hidden transition-colors hover:bg-secondary/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl ?? `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`}
            alt=""
            className="aspect-video w-full object-cover"
          />
          <CardContent className="p-3">
            <p className="line-clamp-2 pr-6 text-sm font-medium">
              {title ?? "제목 없는 영상"}
            </p>
            {lastPositionSec > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {completed
                  ? "완료"
                  : `${Math.floor(lastPositionSec / 60)}분 지점부터 이어보기`}
              </p>
            )}
          </CardContent>
        </Card>
      </Link>

      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="영상 삭제"
        title="목록에서 삭제"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white transition hover:bg-destructive disabled:opacity-50"
      >
        ✕
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
