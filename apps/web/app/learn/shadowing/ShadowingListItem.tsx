"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Film, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";
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
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

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

  const src = thumbnailUrl ?? `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`;

  return (
    <div className="relative">
      <Link href={`/learn/shadowing/${id}`}>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors hover:bg-secondary/40">
          <div className="relative aspect-video w-full overflow-hidden bg-secondary">
            {!loaded && !broken && <Skeleton className="absolute inset-0 rounded-none" />}
            {broken ? (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Film size={28} aria-hidden />
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                onLoad={() => setLoaded(true)}
                onError={() => setBroken(true)}
                className={cn(
                  "aspect-video w-full object-cover transition-opacity duration-300",
                  loaded ? "opacity-100" : "opacity-0",
                )}
              />
            )}
            {completed && (
              <Badge
                variant="success"
                className="absolute bottom-2 right-2 shadow-sm"
              >
                완료
              </Badge>
            )}
          </div>
          <div className="p-3">
            <p className="line-clamp-2 pr-6 text-sm font-medium">
              {title ?? "제목 없는 영상"}
            </p>
            {!completed && lastPositionSec > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {Math.floor(lastPositionSec / 60)}분 지점부터 이어보기
              </p>
            )}
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={remove}
        disabled={pending}
        aria-label="영상 삭제"
        title="목록에서 삭제"
        className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/60 text-background transition hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
      >
        <X size={14} />
      </button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
