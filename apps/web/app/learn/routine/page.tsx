import { redirect } from "next/navigation";
import type { Phase } from "@nativo/core";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getRoutineTasks } from "@/lib/routine";
import { RoutineChecklist } from "./RoutineChecklist";

export default async function RoutinePage() {
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
    .select("selected_language, current_phase")
    .eq("id", user.id)
    .single();

  const language = profile?.selected_language ?? "english";
  const currentPhase = (profile?.current_phase ?? 1) as Phase;
  const tasks = getRoutineTasks(language);

  return (
    <AppShell>
      <main className="container max-w-5xl py-8 lg:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">오늘의 루틴</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            간단한 루틴, 큰 진전. 매일 모든 항목을 완료해 보세요.
          </p>
        </header>

        <RoutineChecklist language={language} tasks={tasks} currentPhase={currentPhase} />
      </main>
    </AppShell>
  );
}
