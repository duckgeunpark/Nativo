import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/server";
import { SESSION_SIZE, parseSessionCookie } from "@/lib/session-size";
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
    .select("selected_language, current_level")
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

  return (
    <>
      <AppHeader />
      <main className="container max-w-lg py-10">
        <h1 className="mb-6 text-2xl font-bold">설정</h1>
        <SettingsForm
          initial={{
            language: profile?.selected_language ?? "english",
            level: profile?.current_level ?? "A2",
            flashcardSize,
            chunkSize,
          }}
        />
      </main>
    </>
  );
}
