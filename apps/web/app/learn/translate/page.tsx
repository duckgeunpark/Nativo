import { redirect } from "next/navigation";
import type { Language } from "@nativo/core";
import { AppShell } from "@/components/AppShell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { TranslateWorkbench } from "./TranslateWorkbench";

interface SessionRow {
  id: string;
  original_text: string;
  user_translation: string;
  score_total: number | null;
  passed: boolean;
  created_at: string;
}

export default async function TranslatePage() {
  if (!isSupabaseConfigured()) {
    return (
      <AppShell>
        <main className="container flex min-h-[60vh] items-center justify-center py-10">
          <SupabaseNotice />
        </main>
      </AppShell>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("selected_language")
    .eq("id", user.id)
    .single();
  const language: Language = profile?.selected_language ?? "english";

  const { data: sessions } = await supabase
    .from("translation_sessions")
    .select("id, original_text, user_translation, score_total, passed, created_at")
    .eq("user_id", user.id)
    .eq("language", language)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<SessionRow[]>();

  return (
    <AppShell>
      <main className="container py-8 sm:py-10">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">번역가 모드</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            원문을 한국어로 번역하고 AI 평가(정확·자연·뉘앙스)를 받아보세요.
          </p>
        </header>

        <TranslateWorkbench language={language} />

        {sessions && sessions.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">지난 번역</h2>
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Card>
                    <CardContent className="py-4">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {s.created_at.slice(0, 10)}
                        </span>
                        {s.score_total !== null && (
                          <span
                            className={
                              s.passed
                                ? "text-sm font-semibold text-success"
                                : "text-sm font-semibold text-muted-foreground"
                            }
                          >
                            {s.score_total}점
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {s.original_text}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm">{s.user_translation}</p>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </AppShell>
  );
}
