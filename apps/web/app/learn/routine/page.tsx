import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { getRoutineTasks } from "@/lib/routine";
import { checkAndAdvancePhase } from "./actions";
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
    .select("selected_language")
    .eq("id", user.id)
    .single();

  const language = profile?.selected_language ?? "english";
  const tasks = getRoutineTasks(language);

  // 조건 충족 시 자동 진급 후, 현재 페이즈의 조건 평가 + 스킬 진단을 받아온다.
  const today = new Date().toISOString().slice(0, 10);
  const progress = await checkAndAdvancePhase(language, today);

  return (
    <AppShell>
      <main className="container py-8 lg:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">오늘의 루틴</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            간단한 루틴, 큰 진전. 매일 모든 항목을 완료해 보세요.
          </p>
        </header>

        <RoutineChecklist
          language={language}
          tasks={tasks}
          currentPhase={progress.currentPhase}
          evaluation={progress.evaluation}
          skillProfile={progress.skillProfile}
          justAdvancedTo={progress.advancedTo}
        />
      </main>
    </AppShell>
  );
}
