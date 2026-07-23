import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { SESSION_SIZE, parseSessionCookie } from "@/lib/session-size";
import { OPENAI_KEY_COOKIE } from "@/lib/openai";
import { DEEPL_KEY_COOKIE } from "@/lib/deepl";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
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
    .select("selected_language, current_level, display_name")
    .eq("id", user.id)
    .single();

  const jar = cookies();
  const flashcardSize = parseSessionCookie(
    jar.get(SESSION_SIZE.flashcard.cookie)?.value,
    SESSION_SIZE.flashcard.default,
  );
  const chunkSize = parseSessionCookie(
    jar.get(SESSION_SIZE.chunk.cookie)?.value,
    SESSION_SIZE.chunk.default,
  );

  // 개인 키는 httpOnly 쿠키 — 화면에는 마지막 4자리만 노출
  const personalKey = jar.get(OPENAI_KEY_COOKIE)?.value ?? null;
  const personalKeyMasked = personalKey ? `sk-…${personalKey.slice(-4)}` : null;

  const deeplKey = jar.get(DEEPL_KEY_COOKIE)?.value ?? null;
  const deeplKeyMasked = deeplKey ? `…${deeplKey.slice(-4)}` : null;

  return (
    <AppShell>
      <main className="container py-8 lg:py-10">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">설정</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            학습 방식과 표시 방식을 내게 맞게 조정해요.
          </p>
        </header>
        <SettingsForm
          initial={{
            language: profile?.selected_language ?? "english",
            level: profile?.current_level ?? "A2",
            displayName: profile?.display_name ?? "",
            flashcardSize,
            chunkSize,
            personalKeyMasked,
            hasEnvKey: Boolean(process.env.OPENAI_API_KEY),
            deeplKeyMasked,
            hasDeeplEnvKey: Boolean(process.env.DEEPL_API_KEY),
          }}
        />
      </main>
    </AppShell>
  );
}
