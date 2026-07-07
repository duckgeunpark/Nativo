"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  BookOpen,
  Mic,
  PenLine,
  CalendarCheck,
  BarChart3,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 앱 공통 쉘 — 6개 목적 탭 내비게이션 (시안 03 + 사용자 확정)
 * 데스크톱: 좌측 사이드바 / 모바일: 상단 바(워드마크+설정) + 하단 고정 탭바
 * active 상태는 URL prefix와 동기화되어 새로고침 후에도 유지된다.
 */
const NAV = [
  { href: "/dashboard", label: "홈", icon: Home, match: ["/dashboard"] },
  {
    href: "/learn/vocabulary",
    label: "어휘",
    icon: BookOpen,
    match: ["/learn/vocabulary", "/learn/flashcards", "/learn/chunks"],
  },
  {
    href: "/learn/speaking",
    label: "말하기",
    icon: Mic,
    match: ["/learn/speaking", "/learn/shadowing", "/learn/roleplay"],
  },
  {
    href: "/learn/writing-reading",
    label: "쓰기·읽기",
    icon: PenLine,
    match: [
      "/learn/writing-reading",
      "/learn/reading",
      "/learn/translate",
      "/learn/journal",
      "/learn/nuance",
    ],
  },
  { href: "/learn/routine", label: "루틴", icon: CalendarCheck, match: ["/learn/routine"] },
  { href: "/learn/stats", label: "통계", icon: BarChart3, match: ["/learn/stats"] },
] as const;

function isActive(pathname: string, matches: readonly string[]) {
  return matches.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      {/* 데스크톱 사이드바 */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-card px-4 py-6 lg:flex">
        <Link href="/dashboard" className="px-3">
          <span className="font-display text-2xl font-bold tracking-tight text-primary">
            Nativo
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Speak your way to native.
          </span>
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="주요 메뉴">
          {NAV.map((item) => {
            const active = isActive(pathname, item.match);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary font-medium text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            pathname.startsWith("/settings")
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Settings className="h-4 w-4 shrink-0" aria-hidden />
          설정
        </Link>
      </aside>

      {/* 모바일 상단 바 */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="font-display text-xl font-bold text-primary">
          Nativo
        </Link>
        <Link
          href="/settings"
          aria-label="설정"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </Link>
      </header>

      {/* 콘텐츠 */}
      <div className="lg:pl-60">
        <div className="pb-24 lg:pb-0">{children}</div>
      </div>

      {/* 모바일 하단 탭바 (6항목) */}
      <nav
        aria-label="하단 탭"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[10px] leading-none transition-colors",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
