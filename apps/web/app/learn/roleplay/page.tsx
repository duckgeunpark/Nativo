import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
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
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">AI 대화</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            상황을 골라 AI와 역할극으로 말하기를 연습하세요.
          </p>
        </header>

        {!isOpenAIConfigured() && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardContent className="py-4 text-sm text-amber-900">
              ⚙️ AI 대화를 사용하려면 서버에 <code>OPENAI_API_KEY</code>가 필요합니다.
              (<code>.env.local</code>에 추가 후 서버 재시작) — 지금은 시나리오 목록만 볼 수 있어요.
            </CardContent>
          </Card>
        )}

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li>
            <Link href="/learn/roleplay/custom">
              <Card className="h-full border-dashed transition-colors hover:bg-secondary/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">✏️</span>
                    <Badge variant="muted">커스텀</Badge>
                  </div>
                  <p className="mt-2 font-medium">커스텀 상황 만들기</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    상황·목표를 직접 정해 대화하기
                  </p>
                </CardContent>
              </Card>
            </Link>
          </li>
          {SCENARIOS.map((s) => (
            <li key={s.id}>
              <Link href={`/learn/roleplay/${s.id}`}>
                <Card className="h-full transition-colors hover:bg-secondary/40">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{s.emoji}</span>
                      <Badge variant="muted">{s.category}</Badge>
                    </div>
                    <p className="mt-2 font-medium">{s.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">미션: {s.userMission}</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
