import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
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
    <>
      <AppHeader />
      <main className="container max-w-2xl py-6">
        <Link href="/learn/roleplay" className="text-sm text-muted-foreground hover:text-foreground">
          ← 시나리오 목록
        </Link>
        <div className="mb-4 mt-2 flex items-center gap-3">
          <span className="text-3xl">{scenario.emoji}</span>
          <div>
            <h1 className="text-lg font-bold">{scenario.title}</h1>
            <p className="text-sm text-muted-foreground">
              상대: {scenario.aiRole} · 미션: {scenario.userMission}
            </p>
          </div>
          <Badge variant="muted" className="ml-auto">
            {scenario.category}
          </Badge>
        </div>

        <RoleplayChat
          scenarioId={scenario.id}
          language={language}
          configured={isOpenAIConfigured()}
        />
      </main>
    </>
  );
}
