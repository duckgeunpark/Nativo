import { redirect } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
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
    .select("selected_language")
    .eq("id", user.id)
    .single();

  const language = profile?.selected_language ?? "english";
  const tasks = getRoutineTasks(language);

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <header className="mb-8">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 대시보드
        </Link>
        <h1 className="mt-2 text-2xl font-bold">오늘의 루틴</h1>
        <p className="mt-1 text-sm text-neutral-600">
          매일 모든 항목을 완료하면 스트릭이 쌓입니다.
        </p>
      </header>

      <RoutineChecklist language={language} tasks={tasks} />
    </main>
  );
}
