import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { NuanceQuiz } from "./NuanceQuiz";

export default async function NuancePage() {
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
      <main className="container max-w-xl py-10">
        <header className="mb-5">
          <h1 className="text-2xl font-bold">뉘앙스 퀴즈</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            상황에 가장 어울리는 표현을 골라 원어민 감각을 훈련하세요.
          </p>
        </header>
        <NuanceQuiz />
      </main>
    </>
  );
}
