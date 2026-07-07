import { cn } from "@/lib/utils";

/**
 * 문서 제목 기반 placeholder 커버 — 목업 이미지 대신 제목 해시로 톤/이니셜을 결정한다.
 * 코랄(highlight)은 CTA·진행 전용이라 커버 장식에는 쓰지 않는다 (CSV 원칙).
 */
const PALETTES = [
  { bg: "bg-primary/10", line: "bg-primary/25", letter: "text-primary/25" },
  { bg: "bg-secondary", line: "bg-foreground/10", letter: "text-foreground/15" },
  { bg: "bg-muted", line: "bg-foreground/10", letter: "text-foreground/15" },
  { bg: "bg-accent", line: "bg-accent-foreground/20", letter: "text-accent-foreground/20" },
] as const;

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function DocCover({
  title,
  badge,
  className,
}: {
  title: string;
  badge?: string;
  className?: string;
}) {
  const palette = PALETTES[hashTitle(title) % PALETTES.length]!;
  const initial = title.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cn(
        "relative flex aspect-[3/4] w-full flex-col justify-between rounded-lg p-3",
        palette.bg,
        className,
      )}
      aria-hidden
    >
      {badge && (
        <span className="self-end rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {badge}
        </span>
      )}
      <span className={cn("font-display text-4xl font-bold leading-none", palette.letter)}>
        {initial}
      </span>
      <div className="space-y-1.5">
        <div className={cn("h-1.5 w-4/5 rounded-full", palette.line)} />
        <div className={cn("h-1.5 w-3/5 rounded-full", palette.line)} />
        <div className={cn("h-1.5 w-2/3 rounded-full", palette.line)} />
      </div>
    </div>
  );
}
