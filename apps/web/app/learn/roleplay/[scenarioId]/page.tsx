import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { isOpenAIConfigured } from "@/lib/openai";
import { getScenario } from "@/lib/roleplay";
import { Badge } from "@/components/ui/badge";
import { RoleplayChat } from "./RoleplayChat";

export default async function RoleplayChatPage({
  params,
}: {
  params: { scenarioId: string };
}) {
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

  const scenario = getScenario(params.scenarioId);
  if (!scenario) notFound();

  return (
    <AppShell>
      <main className="container max-w-4xl py-6">
        <Link
          href="/learn/roleplay"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden /> 시나리오 목록
        </Link>

        <div className="mb-4 mt-3 grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-2xl">
              {scenario.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">파트너 역할</p>
              <p className="font-semibold">{scenario.aiRole}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{scenario.title}</p>
            </div>
          </div>
          <div className="flex items-start justify-between gap-3 sm:border-l sm:pl-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">미션</p>
              <p className="font-semibold">{scenario.userMission}</p>
            </div>
            <Badge variant="muted" className="shrink-0">
              {scenario.category}
            </Badge>
          </div>
        </div>

        <RoleplayChat
          scenarioId={scenario.id}
          language={language}
          configured={isOpenAIConfigured()}
        />
      </main>
    </AppShell>
  );
}
