import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PenLine } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured } from "@/lib/openai";
import { CustomRoleplaySetup } from "./CustomRoleplaySetup";

export default async function CustomRoleplayPage() {
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

  return (
    <AppShell>
      <main className="container max-w-2xl py-6">
        <Link
          href="/learn/roleplay"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden /> 시나리오 목록
        </Link>
        <div className="mb-4 mt-3 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
            <PenLine size={20} aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">
              커스텀 상황 만들기
            </h1>
            <p className="text-sm text-muted-foreground">
              원하는 상황과 목표를 직접 정해 AI와 역할극을 해보세요.
            </p>
          </div>
        </div>

        <CustomRoleplaySetup language={language} configured={isOpenAIConfigured()} />
      </main>
    </AppShell>
  );
}
