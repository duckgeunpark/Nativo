import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
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
    .select("selected_language, current_level, occupation, interests")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-12">
      <header>
        <h1 className="text-2xl font-bold">학습 설정</h1>
        <p className="mt-1 text-sm text-neutral-600">
          어떤 언어를 어떻게 배울지 알려주세요. Phase 4 맞춤 시나리오에 사용됩니다.
        </p>
      </header>

      <OnboardingForm
        initial={{
          selectedLanguage: profile?.selected_language ?? "english",
          currentLevel: profile?.current_level ?? "A2",
          occupation: profile?.occupation ?? "",
          interests: profile?.interests ?? [],
        }}
      />
    </main>
  );
}
