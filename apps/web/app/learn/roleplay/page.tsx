import { redirect } from "next/navigation";
import Link from "next/link";
import { Info, Plus } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured } from "@/lib/openai";
import { SCENARIOS } from "@/lib/roleplay";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function RoleplayPage() {
  if (!isSupabaseConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <SupabaseNotice />
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <main className="container py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">AI 역할극</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            상황을 골라 AI와 역할극으로 말하기를 연습하세요.
          </p>
        </header>

        {!isOpenAIConfigured() && (
          <Card className="mb-6 border-dashed">
            <CardContent className="flex items-start gap-3 py-4 text-sm">
              <Info size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <p className="text-muted-foreground">
                AI 대화를 사용하려면 서버에 <code className="text-foreground">OPENAI_API_KEY</code>
                가 필요합니다. (<code className="text-foreground">.env.local</code>에 추가 후 서버
                재시작) — 지금은 시나리오 목록만 볼 수 있어요.
              </p>
            </CardContent>
          </Card>
        )}

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <Link href="/learn/roleplay/custom" className="block h-full">
              <Card className="h-full border-2 border-dashed transition-colors hover:bg-secondary/40">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed text-muted-foreground">
                      <Plus size={20} aria-hidden />
                    </span>
                    <Badge variant="muted">커스텀</Badge>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">커스텀 상황 만들기</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      상황·목표를 직접 정해 대화하기
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
          {SCENARIOS.map((s) => (
            <li key={s.id}>
              <Link href={`/learn/roleplay/${s.id}`} className="block h-full">
                <Card className="h-full transition-colors hover:bg-secondary/40">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-2xl">
                        {s.emoji}
                      </span>
                      <Badge variant="muted">{s.category}</Badge>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{s.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        미션: {s.userMission}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AppShell>
  );
}
