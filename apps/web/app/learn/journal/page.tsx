import { redirect } from "next/navigation";
import type { Language, WritingCorrection } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { JournalEditor } from "./JournalEditor";

interface JournalRow {
  id: string;
  entry_date: string;
  content: string;
  ai_feedback: string | null;
  corrections: WritingCorrection[];
  word_count: number;
}

export default async function JournalPage() {
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

  const { data: profile } = await supabase
    .from("users")
    .select("selected_language")
    .eq("id", user.id)
    .single();
  const language: Language = profile?.selected_language ?? "english";

  const { data: entries } = await supabase
    .from("writing_journal")
    .select("id, entry_date, content, ai_feedback, corrections, word_count")
    .eq("user_id", user.id)
    .eq("language", language)
    .order("entry_date", { ascending: false })
    .limit(20)
    .returns<JournalRow[]>();

  return (
    <>
      <AppHeader />
      <main className="container max-w-2xl py-10">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">영작 일기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            학습 언어로 일기를 쓰고 AI 첨삭을 받아보세요. 하루 한 편 저장됩니다.
          </p>
        </header>

        <JournalEditor language={language} />

        {entries && entries.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">지난 일기</h2>
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id}>
                  <Card>
                    <CardContent className="py-4">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-medium">{e.entry_date}</span>
                        <span className="text-xs text-muted-foreground">{e.word_count} 단어</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{e.content}</p>
                      {e.ai_feedback && (
                        <p className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                          {e.ai_feedback}
                        </p>
                      )}
                      {e.corrections?.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          첨삭 {e.corrections.length}건
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
