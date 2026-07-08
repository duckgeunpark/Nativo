import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { NuanceQuiz } from "./NuanceQuiz";

export default async function NuancePage() {
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

  return (
    <AppShell>
      <main className="container py-8 sm:py-10">
        <header className="mb-5">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">뉘앙스 퀴즈</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            상황에 가장 어울리는 표현을 골라 원어민 감각을 훈련하세요.
          </p>
        </header>
        <NuanceQuiz />
      </main>
    </AppShell>
  );
}
