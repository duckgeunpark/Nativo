"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/learn/flashcards", label: "플래시카드" },
  { href: "/learn/chunks", label: "청크" },
  { href: "/learn/shadowing", label: "쉐도잉" },
  { href: "/learn/roleplay", label: "AI 대화" },
  { href: "/learn/reading", label: "읽기" },
  { href: "/learn/translate", label: "번역가" },
  { href: "/learn/journal", label: "영작 일기" },
  { href: "/learn/nuance", label: "뉘앙스" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Nativo
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/settings"
            className={cn(
              "whitespace-nowrap text-sm transition-colors",
              pathname === "/settings"
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            설정
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
