import { redirect } from "next/navigation";
import type { Language, WritingCorrection } from "@nativo/core";
import { AppShell } from "@/components/AppShell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { JournalEditor } from "./JournalEditor";
import { JournalEntryItem } from "./JournalEntryItem";

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

  const { data: entries } = await supabase
    .from("writing_journal")
    .select("id, entry_date, content, ai_feedback, corrections, word_count")
    .eq("user_id", user.id)
    .eq("language", language)
    .order("entry_date", { ascending: false })
    .limit(20)
    .returns<JournalRow[]>();

  return (
    <AppShell>
      <main className="container max-w-2xl py-8 sm:py-10">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">영작 일기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            학습 언어로 일기를 쓰고 AI 첨삭을 받아보세요. 하루 한 편 저장됩니다.
          </p>
        </header>

        <JournalEditor language={language} />

        {entries && entries.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">지난 기록</h2>
            <ul className="space-y-3">
              {entries.map((e) => (
                <li key={e.id}>
                  <JournalEntryItem
                    id={e.id}
                    entryDate={e.entry_date}
                    content={e.content}
                    aiFeedback={e.ai_feedback}
                    corrections={e.corrections ?? []}
                    wordCount={e.word_count}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </AppShell>
  );
}
